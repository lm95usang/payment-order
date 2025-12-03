/**
 * 내부 테스트용 결제 주문서 - 공통 유틸리티 함수
 */

/**
 * 숫자를 천 단위 콤마 포맷으로 변환
 * @param {number} num - 변환할 숫자
 * @returns {string} 포맷된 문자열
 */
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * HTML 이스케이프 처리
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

/**
 * 클립보드에 텍스트 복사
 * @param {string} elementId - 복사할 텍스트가 있는 요소 ID
 */
function copyToClipboard(elementId) {
    const text = document.getElementById(elementId).innerText;
    const $btn = $(`button[onclick="copyToClipboard('${elementId}')"]`);

    navigator.clipboard.writeText(text).then(() => {
        // 복사 성공 시 아이콘 변경
        $btn.addClass('copied');
        $btn.find('i').removeClass('bi-clipboard').addClass('bi-check-lg');

        // 2초 후 원래대로 복원
        setTimeout(() => {
            $btn.removeClass('copied');
            $btn.find('i').removeClass('bi-check-lg').addClass('bi-clipboard');
        }, 2000);

        showToast('클립보드에 복사되었습니다.', 'success');
    }).catch(err => {
        console.error('복사 실패:', err);
        showToast('복사에 실패했습니다.', 'danger');
    });
}

/**
 * Toast 알림 표시
 * @param {string} message - 표시할 메시지
 * @param {string} type - 알림 타입 (success, warning, danger, info)
 */
function showToast(message, type = 'info') {
    const bgClass = {
        'success': 'bg-success',
        'warning': 'bg-warning',
        'danger': 'bg-danger',
        'info': 'bg-info'
    }[type] || 'bg-info';

    const textClass = type === 'warning' ? 'text-dark' : 'text-white';

    const toastHtml = `
        <div class="toast align-items-center ${bgClass} ${textClass} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">
                    ${escapeHtml(message)}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;

    const $toast = $(toastHtml);
    $('#toast-container').append($toast);

    const toast = new bootstrap.Toast($toast[0], { delay: 3000 });
    toast.show();

    $toast.on('hidden.bs.toast', function() {
        $(this).remove();
    });
}

/**
 * 대표상품명 생성
 * 상품이 1건이면 상품명만, 2건 이상이면 "상품명 외 N건" 형식으로 반환
 * @param {Array} products - 상품 목록
 * @returns {string} 대표상품명
 */
function getRepresentProductName(products) {
    if (!products || products.length === 0) {
        return '';
    }

    const firstName = products[0].name;
    const count = products.length;

    if (count === 1) {
        return firstName;
    }

    return `${firstName} 외 ${count - 1}건`;
}

/**
 * API 서버 통신 함수
 * @param {string} url - API 엔드포인트 URL
 * @param {string} method - HTTP 메서드 (GET, POST, PUT, DELETE)
 * @param {Object} data - 요청 데이터 (POST/PUT 시)
 * @param {Object} options - 추가 옵션 (headers, timeout 등)
 * @returns {Promise<Object>} 응답 데이터
 */
async function callApi(url, method = 'POST', data = null, options = {}) {
    const defaultOptions = {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        timeout: options.timeout || 30000
    };

    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        defaultOptions.body = JSON.stringify(data);
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), defaultOptions.timeout);

        const response = await fetch(url, {
            ...defaultOptions,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const responseData = await response.json();
        return {
            success: true,
            data: responseData,
            status: response.status
        };
    } catch (error) {
        console.error('API 호출 실패:', error);

        if (error.name === 'AbortError') {
            return {
                success: false,
                error: '요청 시간이 초과되었습니다.',
                status: 0
            };
        }

        return {
            success: false,
            error: error.message,
            status: 0
        };
    }
}

// ============================================
// PG 결제창 관련 함수
// ============================================

/**
 * PG사별 결제창 오픈
 * @param {string} pgId - PG사 ID
 * @param {Object} authResponse - 인증 요청 API 응답 데이터
 * @param {Function} onSuccess - 인증 성공 콜백 (authData)
 * @param {Function} onFailure - 인증 실패 콜백 (error)
 */
function openPaymentWindow(pgId, authResponse, onSuccess, onFailure) {
    const pg = PG.getById(pgId);
    if (!pg) {
        onFailure({ code: 'PG_NOT_FOUND', message: 'PG사 정보를 찾을 수 없습니다.' });
        return;
    }

    switch (pg.windowType) {
        case WINDOW_TYPE.SCRIPT:
            openScriptPaymentWindow(pg, authResponse, onSuccess, onFailure);
            break;
        case WINDOW_TYPE.REDIRECT:
            openRedirectPaymentWindow(pg, authResponse, onSuccess, onFailure);
            break;
        default:
            onFailure({ code: 'UNKNOWN_WINDOW_TYPE', message: '알 수 없는 결제창 타입입니다.' });
    }
}

/**
 * JavaScript SDK 방식 결제창 오픈 (A PG사)
 * @param {Object} pg - PG사 정보
 * @param {Object} authResponse - 인증 응답 데이터
 * @param {Function} onSuccess - 성공 콜백
 * @param {Function} onFailure - 실패 콜백
 */
function openScriptPaymentWindow(pg, authResponse, onSuccess, onFailure) {
    // 실제 구현 시: PG사 SDK 스크립트 로드 후 결제창 호출
    // 예시: window.PG_A_SDK.openPayment({ ... })

    console.log(`[${pg.name}] JavaScript SDK 결제창 오픈`, authResponse);

    // 테스트용 시뮬레이션: 2초 후 인증 성공
    setTimeout(() => {
        // 실제로는 PG사 SDK 콜백에서 처리
        const authData = {
            authToken: authResponse.authToken,
            authCode: 'AUTH_' + Date.now(),
            pgId: pg.id,
            timestamp: new Date().toISOString()
        };
        onSuccess(authData);
    }, 2000);
}

/**
 * URL 리다이렉트 방식 결제창 오픈 (B PG사)
 * @param {Object} pg - PG사 정보
 * @param {Object} authResponse - 인증 응답 데이터
 * @param {Function} onSuccess - 성공 콜백
 * @param {Function} onFailure - 실패 콜백
 */
function openRedirectPaymentWindow(pg, authResponse, onSuccess, onFailure) {
    console.log(`[${pg.name}] URL 리다이렉트 결제창 오픈`, authResponse);

    const paymentUrl = authResponse.paymentUrl;
    if (!paymentUrl) {
        onFailure({ code: 'NO_PAYMENT_URL', message: '결제 URL이 없습니다.' });
        return;
    }

    // 팝업으로 결제창 오픈
    const popup = window.open(paymentUrl, 'paymentPopup', 'width=500,height=700,scrollbars=yes');

    if (!popup) {
        onFailure({ code: 'POPUP_BLOCKED', message: '팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요.' });
        return;
    }

    let isProcessed = false;

    // postMessage 수신 핸들러
    const messageHandler = (event) => {
        // 결제 콜백 메시지인지 확인
        if (!event.data || event.data.type !== 'PAYMENT_CALLBACK') {
            return;
        }

        console.log('[결제 콜백] postMessage 수신:', event.data);

        isProcessed = true;
        cleanup();

        const callbackData = event.data;

        if (callbackData.success) {
            // 성공: 쿼리스트링 전체와 함께 성공 콜백 호출
            const authData = {
                pgId: pg.id,
                queryString: callbackData.queryString,
                timestamp: callbackData.timestamp
            };
            onSuccess(authData);
        } else {
            // 실패: 쿼리스트링 전체와 함께 실패 콜백 호출
            onFailure({
                code: 'AUTH_FAILED',
                message: '결제 인증에 실패했습니다.',
                queryString: callbackData.queryString
            });
        }
    };

    // 팝업 닫힘 감지 (postMessage 없이 닫힌 경우 = 사용자 취소)
    const checkPopup = setInterval(() => {
        if (popup.closed && !isProcessed) {
            cleanup();
            onFailure({ code: 'USER_CANCEL', message: '사용자가 결제를 취소했습니다.' });
        }
    }, 500);

    // 타임아웃 (5분)
    const timeoutId = setTimeout(() => {
        if (!isProcessed) {
            cleanup();
            if (!popup.closed) {
                popup.close();
            }
            onFailure({ code: 'TIMEOUT', message: '결제 시간이 초과되었습니다.' });
        }
    }, 300000);

    // 정리 함수
    function cleanup() {
        window.removeEventListener('message', messageHandler);
        clearInterval(checkPopup);
        clearTimeout(timeoutId);
    }

    // postMessage 리스너 등록
    window.addEventListener('message', messageHandler);
}
