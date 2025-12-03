/**
 * 내부 테스트용 결제 주문서 - 주문서 전용 로직
 *
 * 의존성:
 * - constants.js (상수 정의)
 * - common.js (공통 유틸리티 함수)
 */

// ============================================
// Global State
// ============================================
let products = [];
let paidProducts = [];
let apiHistory = [];
let historyCounter = 0;
let productCounter = 1;
let shippingProducts = [];
let shippingProductCounter = 1;

// 현재 주문 정보 (결제 인증 후 설정됨)
let currentOrder = {
    ordNo: null,      // 서버에서 발급받은 주문번호 (결제/취소 등 모든 트랜잭션의 key)
    orderId: null,    // 클라이언트에서 생성한 주문 ID
    pgId: null,       // 결제한 PG사 ID
    pgName: null      // 결제한 PG사 명
};

// 현재 선택된 스토어 정보
let currentStore = null;

// 토큰 관련 상태
let userTokens = [];  // 사용자의 토큰 목록
let selectedToken = null;  // 현재 선택된 토큰
let isTokenPasswordVerified = false;  // 토큰 비밀번호 확인 여부
let passwordTargetToken = null;  // 비밀번호 설정 대상 토큰

// Bootstrap Modal instances
let apiDetailModal = null;
let partialCancelModal = null;
let tokenRegisterModal = null;
let tokenPasswordModal = null;

// ============================================
// Initialize
// ============================================
$(document).ready(function() {
    // Initialize Bootstrap modals
    apiDetailModal = new bootstrap.Modal(document.getElementById('api-detail-modal'));
    partialCancelModal = new bootstrap.Modal(document.getElementById('partial-cancel-modal'));
    tokenRegisterModal = new bootstrap.Modal(document.getElementById('token-register-modal'));
    tokenPasswordModal = new bootstrap.Modal(document.getElementById('token-password-modal'));

    // 스토어/공통설정 초기화
    initializeStoreSettings();
    initializeCommonSettings();

    bindEvents();
    loadSavedData();
    loadApiHistory();  // API 이력 로드

    // 저장된 데이터가 없으면 기본 상품 추가
    if (products.length === 0) {
        addDefaultProduct();
    }

    updateProductList();
    updateApiHistoryTable();
    setDefaultProductForm();

    // 결제수단에 따른 옵션 표시 초기화
    updatePaymentOptionDisplay();
});

// ============================================
// Store & Common Settings
// ============================================

/**
 * 스토어 설정 초기화
 * 권역, 국가코드, 사업부코드와 스토어는 종속성 없이 독립적으로 동작
 */
function initializeStoreSettings() {
    const $regionSelect = $('#region-select');
    const $storeSelect = $('#store-select');

    // 권역 옵션 추가 (첫 번째 값을 기본값으로)
    STORE.getAllRegions().forEach((region, index) => {
        $regionSelect.append(`<option value="${region.id}" ${index === 0 ? 'selected' : ''}>${region.name} (${region.id})</option>`);
    });

    // 스토어 옵션 추가 - 모든 스토어를 표시
    STORE.list.forEach((store, index) => {
        $storeSelect.append(`<option value="${store.code}" ${index === 0 ? 'selected' : ''}>${store.name} (${store.code})</option>`);
    });

    // 스토어 변경 시 결제수단 업데이트 (스토어만 결제수단에 영향)
    $storeSelect.on('change', function() {
        const storeCode = $(this).val();
        onStoreChange(storeCode);
    });

    // 초기 스토어 선택 처리
    const firstStore = STORE.list[0];
    if (firstStore) {
        onStoreChange(firstStore.code);
    }
}


/**
 * 스토어 변경 시 호출
 */
function onStoreChange(storeCode) {
    currentStore = storeCode ? STORE.getByCode(storeCode) : null;

    // 결제수단 업데이트
    updatePaymentMethods();
}

/**
 * 스토어에 따른 결제수단 동적 렌더링
 */
function updatePaymentMethods() {
    const $noStore = $('#no-store-message');
    const $container = $('#payment-method-container');
    const $list = $('#payment-method-list');

    if (!currentStore) {
        $noStore.show();
        $container.hide();
        $('.payment-option').removeClass('show');
        return;
    }

    $noStore.hide();
    $container.show();
    $list.empty();

    const methods = STORE.getPaymentMethods(currentStore.code);

    methods.forEach((method, index) => {
        const inputId = `pm-${method.id.toLowerCase()}`;
        const isFirst = index === 0;

        $list.append(`
            <div class="col-md-6">
                <label class="form-check" for="${inputId}">
                    <input class="form-check-input" type="radio" name="payment-method"
                           value="${method.id}" id="${inputId}" ${isFirst ? 'checked' : ''}>
                    <span class="form-check-label">
                        <i class="${method.icon} me-1"></i>${method.name}
                    </span>
                </label>
            </div>
        `);
    });

    // 결제수단 변경 이벤트 바인딩
    $list.find('input[name="payment-method"]').on('change', updatePaymentOptionDisplay);

    // 첫 번째 결제수단 옵션 표시
    updatePaymentOptionDisplay();
}

/**
 * 공통 설정 초기화
 */
function initializeCommonSettings() {
    const $countrySelect = $('#country-code-select');
    const $bizSelect = $('#biz-code-select');

    // 국가 코드 옵션 추가 (첫 번째 값을 기본값으로)
    COUNTRY.list.forEach((country, index) => {
        $countrySelect.append(`<option value="${country.code}" ${index === 0 ? 'selected' : ''}>${country.name} (${country.code})</option>`);
    });

    // 사업부 코드 옵션 추가 (첫 번째 값을 기본값으로)
    BIZ_CODE.list.forEach((biz, index) => {
        $bizSelect.append(`<option value="${biz.code}" ${index === 0 ? 'selected' : ''}>${biz.name} (${biz.code})</option>`);
    });
}

/**
 * 공통 설정값 조회
 * 모든 설정값은 드롭다운에서 직접 선택한 값을 사용 (종속성 없음)
 */
function getCommonSettings() {
    return {
        region: $('#region-select').val(),
        bizCode: $('#biz-code-select').val(),
        storeCode: $('#store-select').val(),
        countryCode: $('#country-code-select').val()
    };
}

// ============================================
// Event Binding
// ============================================
function bindEvents() {
    // Add product
    $('#btn-add-product').on('click', addProduct);

    // Payment method change - 동적으로 바인딩됨 (updatePaymentMethods 에서 처리)
    // $('input[name="payment-method"]').on('change', updatePaymentOptionDisplay);

    // Action buttons
    $('#btn-pay').on('click', processPayment);
    $('#btn-deposit-complete').on('click', processDepositComplete);
    $('#btn-cancel-all').on('click', processCancelAll);
    $('#btn-cancel-partial').on('click', openPartialCancelModal);
    $('#btn-confirm-partial-cancel').on('click', confirmPartialCancel);

    // Enter key for adding product
    $('.product-form input').on('keypress', function(e) {
        if (e.which === 13) {
            addProduct();
        }
    });

    // API history row click
    $(document).on('click', '.api-history-row', function() {
        const index = $(this).data('index');
        showApiDetail(index);
    });

    // 부분취소 모달 - 배송비 상품 추가
    $('#btn-add-shipping-product').on('click', addShippingProduct);

    // 부분취소 모달 - 취소 금액 변경 시 합계 업데이트
    $(document).on('change input', '.cancel-price-input, .cancel-shipping-input', updateCancelTotals);

    // 부분취소 모달 - 상품 체크박스 변경 시
    $(document).on('change', '.cancel-product-checkbox', function() {
        const $item = $(this).closest('.cancel-product-item');
        const $inputs = $item.find('.cancel-price-input, .cancel-shipping-input');
        if ($(this).is(':checked')) {
            $inputs.prop('disabled', false);
        } else {
            $inputs.prop('disabled', true);
        }
        updateCancelTotals();
    });

    // Key-in 카드번호 자동 포맷팅
    $('#keyin-card-number').on('input', function() {
        let value = $(this).val().replace(/\D/g, '');
        if (value.length > 16) value = value.slice(0, 16);
        let formatted = value.match(/.{1,4}/g);
        $(this).val(formatted ? formatted.join('-') : '');
    });

    // 토큰 등록 카드번호 자동 포맷팅
    $('#new-token-card-number').on('input', function() {
        let value = $(this).val().replace(/\D/g, '');
        if (value.length > 16) value = value.slice(0, 16);
        let formatted = value.match(/.{1,4}/g);
        $(this).val(formatted ? formatted.join('-') : '');
    });

    // 토큰 관리 버튼 이벤트
    $('#btn-refresh-tokens').on('click', loadTokenList);
    $('#btn-register-token').on('click', openTokenRegisterModal);
    $('#btn-confirm-register-token').on('click', registerToken);
    $('#btn-confirm-set-password').on('click', setTokenPassword);
    $('#btn-verify-token-password').on('click', verifyTokenPassword);

    // 토큰 선택 이벤트 (동적 요소)
    $(document).on('click', '.token-item', function() {
        selectToken($(this).data('token-id'));
    });

    // 토큰 삭제 버튼 이벤트 (동적 요소)
    $(document).on('click', '.btn-delete-token', function(e) {
        e.stopPropagation();
        deleteToken($(this).data('token-id'));
    });

    // 토큰 비밀번호 설정 버튼 이벤트 (동적 요소)
    $(document).on('click', '.btn-set-token-password', function(e) {
        e.stopPropagation();
        openTokenPasswordModal($(this).data('token-id'));
    });

    // 비밀번호 입력 필드 숫자만 허용
    $('#set-token-password, #confirm-token-password, #token-password-input').on('input', function() {
        $(this).val($(this).val().replace(/\D/g, ''));
    });
}

// ============================================
// Payment Option Display
// ============================================
function updatePaymentOptionDisplay() {
    const method = $('input[name="payment-method"]:checked').val();
    $('.payment-option').removeClass('show');

    if (method === 'CARD') {
        $('#card-option').addClass('show');
    } else if (method === 'VBANK') {
        $('#vbank-option').addClass('show');
    } else if (method === 'KEYIN') {
        $('#keyin-option').addClass('show');
    } else if (method === 'TOKEN') {
        $('#token-option').addClass('show');
        // 토큰결제 선택 시 토큰 목록 로드
        loadTokenList();
    }

    // 가상계좌 선택 시에만 입금완료 버튼 표시
    if (method === 'VBANK') {
        $('#btn-deposit-complete').show();
    } else {
        $('#btn-deposit-complete').hide();
    }
}

// ============================================
// Product Management
// ============================================
function addDefaultProduct() {
    products.push({
        id: DEFAULT_PRODUCT.id + productCounter,
        name: DEFAULT_PRODUCT.name + productCounter,
        price: DEFAULT_PRODUCT.price,
        shipping: DEFAULT_PRODUCT.shipping,
        deliveryGroup: DEFAULT_PRODUCT.deliveryGroup,
        sellerNo: DEFAULT_PRODUCT.sellerNo
    });
    productCounter++;
}

function setDefaultProductForm() {
    $('#prod-id').val(DEFAULT_PRODUCT.id + productCounter);
    $('#prod-name').val(DEFAULT_PRODUCT.name + productCounter);
    $('#prod-price').val(DEFAULT_PRODUCT.price);
    $('#prod-shipping').val(DEFAULT_PRODUCT.shipping);
    $('#prod-delivery-group').val(DEFAULT_PRODUCT.deliveryGroup);
    $('#prod-seller-no').val(DEFAULT_PRODUCT.sellerNo);
}

function addProduct() {
    const id = $('#prod-id').val().trim();
    const name = $('#prod-name').val().trim();
    const price = parseInt($('#prod-price').val()) || 0;
    const shipping = parseInt($('#prod-shipping').val()) || 0;
    const deliveryGroup = $('#prod-delivery-group').val().trim();
    const sellerNo = $('#prod-seller-no').val().trim();

    if (!id || !name || price <= 0) {
        showToast('상품ID, 상품명, 상품금액은 필수입니다.', 'warning');
        return;
    }

    products.push({ id, name, price, shipping, deliveryGroup, sellerNo });
    productCounter++;
    updateProductList();
    setDefaultProductForm();
    showToast('상품이 추가되었습니다.', 'success');
}

function removeProduct(index) {
    products.splice(index, 1);
    updateProductList();
}

function updateProductList() {
    const $list = $('#product-list');
    $list.empty();

    if (products.length === 0) {
        $list.html(`
            <div class="text-center text-muted py-4">
                <i class="bi bi-box-seam fs-1 d-block mb-2"></i>
                상품을 추가해주세요.
            </div>
        `);
    } else {
        products.forEach((product, index) => {
            const total = product.price + product.shipping;
            const extraInfo = [];
            if (product.deliveryGroup) extraInfo.push(`배송그룹: ${escapeHtml(product.deliveryGroup)}`);
            if (product.sellerNo) extraInfo.push(`셀러: ${escapeHtml(product.sellerNo)}`);
            const extraInfoStr = extraInfo.length > 0 ? `<br><small class="text-info">${extraInfo.join(' | ')}</small>` : '';

            $list.append(`
                <div class="list-group-item d-flex justify-content-between align-items-center">
                    <div class="product-info">
                        <div class="fw-bold">${escapeHtml(product.name)}</div>
                        <small class="text-muted">
                            ID: ${escapeHtml(product.id)} |
                            금액: ${formatNumber(product.price)}원 |
                            배송비: ${formatNumber(product.shipping)}원 |
                            <span class="text-primary fw-bold">합계: ${formatNumber(total)}원</span>
                        </small>${extraInfoStr}
                    </div>
                    <button class="btn btn-outline-danger btn-sm" onclick="removeProduct(${index})">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `);
        });
    }

    updateTotalAmount();
}

function updateTotalAmount() {
    const total = products.reduce((sum, p) => sum + p.price + p.shipping, 0);
    $('#total-amount').text(formatNumber(total) + '원');
}

// ============================================
// Order & Payment Data
// ============================================
function getOrderData() {
    return {
        products: products,
        customer: {
            name: $('#customer-name').val(),
            phone: $('#customer-phone').val(),
            email: $('#customer-email').val(),
            userNo: $('#customer-userno').val()
        }
    };
}

function getPaymentData() {
    const method = $('input[name="payment-method"]:checked').val();
    const data = { method };

    if (method === 'CARD') {
        data.cardCompany = $('#card-company').val();
        data.installment = $('#card-installment').val();
        data.useCardPoint = $('input[name="card-point"]:checked').val();
    } else if (method === 'VBANK') {
        data.bank = $('#bank').val();
    } else if (method === 'KEYIN') {
        data.cardNumber = $('#keyin-card-number').val();
        data.expMonth = $('#keyin-exp-month').val();
        data.expYear = $('#keyin-exp-year').val();
    } else if (method === 'TOKEN') {
        if (selectedToken) {
            data.tokenId = selectedToken.tokenId;
            data.tokenName = selectedToken.name;
        }
    }

    return data;
}

// ============================================
// Payment Processing (인증/승인 분리 방식)
// ============================================

/**
 * 결제 프로세스 시작 (Step 1: 인증 요청)
 */
function processPayment() {
    // 스토어 필수값 검증
    if (!currentStore) {
        showToast('스토어를 먼저 선택해주세요.', 'warning');
        $('#store-select').focus();
        return;
    }

    if (products.length === 0) {
        showToast('결제할 상품이 없습니다.', 'warning');
        return;
    }

    // userNo 필수값 검증
    const userNo = $('#customer-userno').val().trim();
    if (!userNo) {
        showToast('userNo는 필수 입력값입니다.', 'warning');
        $('#customer-userno').focus();
        return;
    }

    const orderData = getOrderData();
    const paymentData = getPaymentData();

    // Validation
    if (!validatePaymentData(paymentData)) {
        return;
    }

    // 토큰결제: 인증/승인 분리 없이 바로 결제 완료
    if (paymentData.method === 'TOKEN') {
        processTokenPayment(orderData, paymentData);
        return;
    }

    // 일반 결제: 인증 요청 API 호출 (PG사는 서버에서 결정)
    requestPaymentAuth(orderData, paymentData);
}

/**
 * 결제 데이터 유효성 검증
 */
function validatePaymentData(paymentData) {
    if (paymentData.method === 'CARD' && !paymentData.cardCompany) {
        showToast('카드사를 선택해주세요.', 'warning');
        return false;
    }
    if (paymentData.method === 'VBANK' && !paymentData.bank) {
        showToast('은행을 선택해주세요.', 'warning');
        return false;
    }
    if (paymentData.method === 'KEYIN') {
        if (!paymentData.cardNumber) {
            showToast('카드번호를 입력해주세요.', 'warning');
            $('#keyin-card-number').focus();
            return false;
        }
        if (!paymentData.expMonth) {
            showToast('유효월을 선택해주세요.', 'warning');
            return false;
        }
        if (!paymentData.expYear) {
            showToast('유효년도를 선택해주세요.', 'warning');
            return false;
        }
    }
    if (paymentData.method === 'TOKEN') {
        if (!selectedToken) {
            showToast('결제할 토큰을 선택해주세요.', 'warning');
            return false;
        }
        if (selectedToken.hasPassword && !isTokenPasswordVerified) {
            showToast('토큰 비밀번호를 확인해주세요.', 'warning');
            $('#token-password-input').focus();
            return false;
        }
    }
    return true;
}

/**
 * Step 1: 결제 인증 요청
 * 멀티PG 분배 방식: 서버에서 PG사를 결정하고 응답으로 pgId와 windowType을 전달
 */
function requestPaymentAuth(orderData, paymentData) {
    const orderId = 'ORD' + Date.now();

    // 금액 합계 계산
    const productAmount = products.reduce((sum, p) => sum + p.price, 0);      // 상품금액 합계
    const shippingAmount = products.reduce((sum, p) => sum + p.shipping, 0);  // 배송비 합계
    const totalAmount = productAmount + shippingAmount;                        // 전체 합계

    // 대표상품명 생성 (상품명 외 N건)
    const representProductName = getRepresentProductName(products);

    // 공통 설정값 조회
    const commonSettings = getCommonSettings();

    // returnUrl: 성공/실패 콜백 페이지 경로
    const baseUrl = window.location.href.replace(/\/[^\/]*$/, '');
    const returnUrl = baseUrl + '/payment-callback.html';
    const failUrl = baseUrl + '/payment-callback-fail.html';

    const authRequestData = {
        // 공통 설정값
        storeCode: commonSettings.storeCode,
        region: commonSettings.region,
        countryCode: commonSettings.countryCode,
        bizCode: commonSettings.bizCode,
        // 주문 정보
        orderId: orderId,
        representProductName: representProductName,  // 대표상품명
        productAmount: productAmount,                // 상품금액 합계
        shippingAmount: shippingAmount,              // 배송비 합계
        totalAmount: totalAmount,                    // 전체 합계
        orderData: orderData,
        paymentData: paymentData,
        returnUrl: returnUrl,
        failUrl: failUrl
    };

    // 시뮬레이션: 인증 요청 API 응답
    // 실제로는 서버에서 멀티PG 분배 로직에 따라 PG사가 결정되고 응답됨
    // 테스트용: 랜덤으로 PG사 선택
    const randomPgId = Math.random() > 0.5 ? 'PG_A' : 'PG_B';
    const pg = PG.getById(randomPgId);

    // 시뮬레이션: 서버에서 발급하는 주문번호
    const serverOrdNo = 'ORD' + Date.now() + Math.random().toString(36).slice(2, 6).toUpperCase();

    const authResponseData = {
        billing: {
            resultCode: '0',
            ordNo: serverOrdNo,  // 서버에서 발급한 주문번호 (모든 트랜잭션의 key)
            orderId: orderId,
            // 서버에서 결정된 PG사 정보
            pgId: randomPgId,
            pgName: pg.name,
            windowType: pg.windowType,
            // 인증 토큰
            authToken: 'AUTH_TOKEN_' + Date.now(),
            // PG사 타입에 따른 응답 데이터
            ...(pg.windowType === WINDOW_TYPE.SCRIPT ? {
                // A PG사 (SDK 방식): SDK 호출에 필요한 데이터
                merchantId: 'MERCHANT_001',
                signData: 'SIGN_' + Math.random().toString(36).slice(2, 10).toUpperCase()
            } : {
                // B PG사 (URL 방식): 결제 URL
                // 테스트용 - 성공 시 returnUrl로 리다이렉트
                paymentUrl: returnUrl + '?resultCode=0&authCode=AUTH_' + Date.now() + '&orderId=' + orderId + '&authToken=AUTH_TOKEN_' + Date.now()
            })
        }
    };

    addApiHistory('AUTH001', authRequestData, authResponseData);

    const authBilling = authResponseData.billing;
    if (authBilling.resultCode !== '0') {
        showToast(authBilling.errMsg || '인증 요청에 실패했습니다.', 'danger');
        return;
    }

    // 주문 정보 저장 (모든 트랜잭션에서 사용)
    currentOrder = {
        ordNo: authBilling.ordNo,
        orderId: authBilling.orderId,
        pgId: authBilling.pgId,
        pgName: authBilling.pgName
    };

    showToast(`[${authBilling.pgName}] 결제창을 여는 중...`, 'info');

    // Step 2: 서버 응답의 PG사 정보로 결제창 오픈
    openPaymentWindow(
        authBilling.pgId,
        authBilling,
        // 인증 성공 콜백
        (authData) => {
            showToast('인증이 완료되었습니다. 승인 요청 중...', 'info');
            requestPaymentApprove(orderId, authData);
        },
        // 인증 실패 콜백
        (error) => {
            showToast(`인증 실패: ${error.message}`, 'danger');
        }
    );
}

/**
 * Step 3: 결제 승인 요청
 * authData.queryString: PG사에서 전달받은 쿼리스트링 전체 (파싱하지 않음)
 */
function requestPaymentApprove(orderId, authData) {
    const approveRequestData = {
        ordNo: currentOrder.ordNo,  // 서버에서 발급받은 주문번호
        orderId: orderId,
        pgId: authData.pgId,
        // PG사 응답 쿼리스트링 전체를 그대로 서버에 전달
        pgResponseQueryString: authData.queryString,
        timestamp: authData.timestamp
    };

    // 시뮬레이션: 승인 요청 API 응답
    const approveResponseData = {
        billing: {
            resultCode: '0',
            ordNo: currentOrder.ordNo,
            orderId: orderId,
            transactionId: 'TXN' + Date.now(),
            approvalNumber: 'APR' + Math.random().toString(36).slice(2, 8).toUpperCase(),
            approvalDate: new Date().toISOString(),
            pgId: authData.pgId,
            pgName: PG.getName(authData.pgId)
        }
    };

    addApiHistory('APPROVE001', approveRequestData, approveResponseData);

    const approveBilling = approveResponseData.billing;
    if (approveBilling.resultCode !== '0') {
        showToast(approveBilling.errMsg || '결제 승인에 실패했습니다.', 'danger');
        return;
    }

    // 결제 완료 처리
    paidProducts = [...products];

    if ($('#save-info').is(':checked')) {
        saveData();
    }

    showToast(`결제가 완료되었습니다. [${approveBilling.pgName}] 승인번호: ${approveBilling.approvalNumber}`, 'success');
}

function processDepositComplete() {
    if (paidProducts.length === 0) {
        showToast('입금완료 처리할 결제 내역이 없습니다.', 'warning');
        return;
    }

    if (!currentOrder.ordNo) {
        showToast('주문 정보가 없습니다. 결제를 먼저 진행해주세요.', 'warning');
        return;
    }

    const requestData = {
        ordNo: currentOrder.ordNo,  // 서버에서 발급받은 주문번호
        depositType: 'VBANK_DEPOSIT',
        products: paidProducts,
        depositAmount: paidProducts.reduce((sum, p) => sum + p.price + p.shipping, 0),
        depositDate: new Date().toISOString()
    };

    const responseData = {
        billing: {
            resultCode: '0',
            ordNo: currentOrder.ordNo,
            depositId: 'DEP' + Date.now(),
            confirmDate: new Date().toISOString()
        }
    };

    addApiHistory('DEPOSIT001', requestData, responseData);

    const depositBilling = responseData.billing;
    if (depositBilling.resultCode !== '0') {
        showToast(depositBilling.errMsg || '입금완료 처리에 실패했습니다.', 'danger');
        return;
    }

    showToast('입금완료 처리가 완료되었습니다.', 'success');
}

// ============================================
// Cancel Processing
// ============================================
function processCancelAll() {
    if (paidProducts.length === 0) {
        showToast('취소할 결제 내역이 없습니다.', 'warning');
        return;
    }

    if (!currentOrder.ordNo) {
        showToast('주문 정보가 없습니다.', 'warning');
        return;
    }

    if (!confirm('전체 결제를 취소하시겠습니까?')) {
        return;
    }

    const requestData = {
        ordNo: currentOrder.ordNo,  // 서버에서 발급받은 주문번호
        cancelType: 'FULL',
        products: paidProducts,
        cancelAmount: paidProducts.reduce((sum, p) => sum + p.price + p.shipping, 0),
        cancelReason: '고객 요청'
    };

    const responseData = {
        billing: {
            resultCode: '0',
            ordNo: currentOrder.ordNo,
            cancelId: 'CAN' + Date.now(),
            cancelDate: new Date().toISOString()
        }
    };

    addApiHistory('CANCEL001', requestData, responseData);

    const cancelBilling = responseData.billing;
    if (cancelBilling.resultCode !== '0') {
        showToast(cancelBilling.errMsg || '전체취소에 실패했습니다.', 'danger');
        return;
    }

    paidProducts = [];
    // 전체 취소 후 주문 정보 초기화
    currentOrder = { ordNo: null, orderId: null, pgId: null, pgName: null };
    showToast('전체 취소가 완료되었습니다.', 'success');
}

function openPartialCancelModal() {
    if (paidProducts.length === 0) {
        showToast('취소할 결제 내역이 없습니다.', 'warning');
        return;
    }

    if (!currentOrder.ordNo) {
        showToast('주문 정보가 없습니다.', 'warning');
        return;
    }

    // 초기화
    shippingProducts = [];
    shippingProductCounter = 1;
    const $list = $('#cancel-product-list');
    $list.empty();

    paidProducts.forEach((product, index) => {
        const extraInfo = [];
        if (product.deliveryGroup) extraInfo.push(`배송그룹: ${escapeHtml(product.deliveryGroup)}`);
        if (product.sellerNo) extraInfo.push(`셀러: ${escapeHtml(product.sellerNo)}`);
        const extraInfoStr = extraInfo.length > 0 ? `<span class="text-info">${extraInfo.join(' | ')}</span>` : '';

        $list.append(`
            <div class="list-group-item cancel-product-item" data-index="${index}">
                <div class="d-flex align-items-start">
                    <div class="form-check me-2">
                        <input class="form-check-input cancel-product-checkbox" type="checkbox" id="cancel-${index}" data-index="${index}">
                    </div>
                    <div class="flex-grow-1">
                        <label class="form-check-label w-100" for="cancel-${index}">
                            <div class="fw-bold">${escapeHtml(product.name)}</div>
                            <small class="text-muted">
                                ID: ${escapeHtml(product.id)} ${extraInfoStr ? '| ' + extraInfoStr : ''}
                            </small>
                        </label>
                        <div class="row g-2 mt-2">
                            <div class="col-6">
                                <label class="form-label small mb-1">취소 상품금액</label>
                                <input type="number" class="form-control form-control-sm cancel-price-input"
                                    value="${product.price}" data-max="${product.price}" disabled>
                            </div>
                            <div class="col-6">
                                <label class="form-label small mb-1">취소 배송비</label>
                                <input type="number" class="form-control form-control-sm cancel-shipping-input"
                                    value="${product.shipping}" data-max="${product.shipping}" disabled>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);
    });

    updateShippingProductList();
    updateCancelTotals();
    clearShippingProductForm();

    partialCancelModal.show();
}

function confirmPartialCancel() {
    const cancelProducts = [];
    let totalCancelAmount = 0;

    $('.cancel-product-item').each(function() {
        const $item = $(this);
        const $checkbox = $item.find('.cancel-product-checkbox');
        if ($checkbox.is(':checked')) {
            const index = $checkbox.data('index');
            const product = paidProducts[index];
            const cancelPrice = parseInt($item.find('.cancel-price-input').val()) || 0;
            const cancelShipping = parseInt($item.find('.cancel-shipping-input').val()) || 0;

            cancelProducts.push({
                ...product,
                cancelPrice: cancelPrice,
                cancelShipping: cancelShipping
            });
            totalCancelAmount += cancelPrice + cancelShipping;
        }
    });

    if (cancelProducts.length === 0) {
        showToast('취소할 상품을 선택해주세요.', 'warning');
        return;
    }

    const totalAddShippingFee = shippingProducts.reduce((sum, p) => sum + p.fee, 0);

    const requestData = {
        ordNo: currentOrder.ordNo,  // 서버에서 발급받은 주문번호
        cancelType: 'PARTIAL',
        cancelProducts: cancelProducts,
        cancelAmount: totalCancelAmount,
        cancelReason: '부분 취소 요청'
    };

    if (shippingProducts.length > 0) {
        requestData.addShippingProducts = shippingProducts.map(p => ({
            id: p.id,
            name: p.name,
            shippingFee: p.fee,
            deliveryGroup: p.deliveryGroup,
            sellerNo: p.sellerNo
        }));
        requestData.addShippingFee = totalAddShippingFee;
    }

    const responseData = {
        billing: {
            resultCode: '0',
            ordNo: currentOrder.ordNo,
            cancelId: 'PCAN' + Date.now(),
            cancelDate: new Date().toISOString(),
            cancelledProducts: cancelProducts.map(p => p.id),
            cancelAmount: totalCancelAmount
        }
    };

    if (shippingProducts.length > 0) {
        responseData.billing.addedShippingProducts = shippingProducts.map(p => p.id);
        responseData.billing.addShippingFee = totalAddShippingFee;
    }

    addApiHistory('CANCEL002', requestData, responseData);

    const partialCancelBilling = responseData.billing;
    if (partialCancelBilling.resultCode !== '0') {
        showToast(partialCancelBilling.errMsg || '부분취소에 실패했습니다.', 'danger');
        return;
    }

    // 취소된 상품 처리
    cancelProducts.forEach(cancelProduct => {
        const paidIndex = paidProducts.findIndex(p => p.id === cancelProduct.id);
        if (paidIndex !== -1) {
            const paid = paidProducts[paidIndex];
            if (cancelProduct.cancelPrice >= paid.price && cancelProduct.cancelShipping >= paid.shipping) {
                paidProducts.splice(paidIndex, 1);
            } else {
                paid.price -= cancelProduct.cancelPrice;
                paid.shipping -= cancelProduct.cancelShipping;
            }
        }
    });

    partialCancelModal.hide();

    let message = `${cancelProducts.length}개 상품이 취소되었습니다. 취소금액: ${formatNumber(totalCancelAmount)}원`;
    if (shippingProducts.length > 0) {
        message += ` / 추가 배송비: ${formatNumber(totalAddShippingFee)}원`;
    }
    showToast(message, 'success');
}

// ============================================
// Shipping Product Management (Partial Cancel)
// ============================================
function addShippingProduct() {
    const id = $('#shipping-prod-id').val().trim();
    const name = $('#shipping-prod-name').val().trim();
    const fee = parseInt($('#shipping-prod-fee').val()) || 0;
    const deliveryGroup = $('#shipping-prod-delivery-group').val().trim();
    const sellerNo = $('#shipping-prod-seller-no').val().trim();

    if (!id || !name || fee <= 0) {
        showToast('상품ID, 상품명, 배송비는 필수입니다.', 'warning');
        return;
    }

    shippingProducts.push({ id, name, fee, deliveryGroup, sellerNo });
    shippingProductCounter++;
    updateShippingProductList();
    updateCancelTotals();
    clearShippingProductForm();
    showToast('배송비 상품이 추가되었습니다.', 'success');
}

function removeShippingProduct(index) {
    shippingProducts.splice(index, 1);
    updateShippingProductList();
    updateCancelTotals();
}

function clearShippingProductForm() {
    $('#shipping-prod-id').val(DEFAULT_SHIPPING_PRODUCT.id + shippingProductCounter);
    $('#shipping-prod-name').val(DEFAULT_SHIPPING_PRODUCT.name + shippingProductCounter);
    $('#shipping-prod-fee').val(DEFAULT_SHIPPING_PRODUCT.fee);
    $('#shipping-prod-delivery-group').val(DEFAULT_SHIPPING_PRODUCT.deliveryGroup);
    $('#shipping-prod-seller-no').val(DEFAULT_SHIPPING_PRODUCT.sellerNo);
}

function updateShippingProductList() {
    const $list = $('#shipping-product-list');
    const $noData = $('#no-shipping-products');
    $list.empty();

    if (shippingProducts.length === 0) {
        $noData.show();
        return;
    }

    $noData.hide();
    shippingProducts.forEach((product, index) => {
        const extraInfo = [];
        if (product.deliveryGroup) extraInfo.push(`배송그룹: ${escapeHtml(product.deliveryGroup)}`);
        if (product.sellerNo) extraInfo.push(`셀러: ${escapeHtml(product.sellerNo)}`);
        const extraInfoStr = extraInfo.length > 0 ? `<br><small class="text-info">${extraInfo.join(' | ')}</small>` : '';

        $list.append(`
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div>
                    <div class="fw-bold">${escapeHtml(product.name)}</div>
                    <small class="text-muted">
                        ID: ${escapeHtml(product.id)} | 배송비: <span class="text-success fw-bold">${formatNumber(product.fee)}원</span>
                    </small>${extraInfoStr}
                </div>
                <button class="btn btn-outline-danger btn-sm" onclick="removeShippingProduct(${index})">
                    <i class="bi bi-trash"></i>
                </button>
            </div>
        `);
    });
}

function updateCancelTotals() {
    let totalCancel = 0;
    let totalShipping = 0;

    $('.cancel-product-item').each(function() {
        const $checkbox = $(this).find('.cancel-product-checkbox');
        if ($checkbox.is(':checked')) {
            const price = parseInt($(this).find('.cancel-price-input').val()) || 0;
            const shipping = parseInt($(this).find('.cancel-shipping-input').val()) || 0;
            totalCancel += price + shipping;
        }
    });

    shippingProducts.forEach(p => {
        totalShipping += p.fee;
    });

    $('#total-cancel-amount').text(formatNumber(totalCancel) + '원');
    $('#total-shipping-amount').text(formatNumber(totalShipping) + '원');
}

// ============================================
// API History
// ============================================
const MAX_API_HISTORY = 20;  // 최대 저장 개수

function addApiHistory(apiId, request, response) {
    historyCounter++;
    apiHistory.unshift({
        no: historyCounter,
        apiId: apiId,
        timestamp: new Date().toLocaleString(),
        request: request,
        response: response
    });

    // 최대 개수 초과 시 가장 오래된 항목 제거
    if (apiHistory.length > MAX_API_HISTORY) {
        apiHistory.pop();
    }

    // LocalStorage에 저장
    saveApiHistory();
    updateApiHistoryTable();
}

/**
 * API 이력을 LocalStorage에 저장
 */
function saveApiHistory() {
    const data = {
        historyCounter: historyCounter,
        apiHistory: apiHistory
    };
    localStorage.setItem('apiHistoryData', JSON.stringify(data));
}

/**
 * LocalStorage에서 API 이력 로드
 */
function loadApiHistory() {
    const savedData = localStorage.getItem('apiHistoryData');
    if (!savedData) return;

    try {
        const data = JSON.parse(savedData);
        if (data.apiHistory && Array.isArray(data.apiHistory)) {
            apiHistory = data.apiHistory;
            historyCounter = data.historyCounter || apiHistory.length;
        }
    } catch (e) {
        console.error('Failed to load API history:', e);
    }
}

/**
 * API 이력 전체 삭제
 */
function clearApiHistory() {
    if (!confirm('API 송수신 전문 이력을 모두 삭제하시겠습니까?')) {
        return;
    }
    apiHistory = [];
    historyCounter = 0;
    localStorage.removeItem('apiHistoryData');
    updateApiHistoryTable();
    showToast('API 이력이 삭제되었습니다.', 'success');
}

function updateApiHistoryTable() {
    const $tbody = $('#api-history-body');
    const $noData = $('#no-history');
    const $footer = $('#history-footer');

    $tbody.empty();

    if (apiHistory.length === 0) {
        $noData.show();
        $footer.hide();
        $tbody.closest('table').hide();
        return;
    }

    $noData.hide();
    $footer.show();
    $tbody.closest('table').show();

    apiHistory.forEach((item, index) => {
        const requestStr = JSON.stringify(item.request);
        const responseStr = JSON.stringify(item.response);
        const apiName = API.getName(item.apiId);

        $tbody.append(`
            <tr class="api-history-row" data-index="${index}" style="cursor: pointer;">
                <td>${item.no}</td>
                <td><span class="badge bg-primary">${item.apiId}</span></td>
                <td>${apiName}</td>
                <td><small class="text-muted">${item.timestamp}</small></td>
                <td class="json-cell text-truncate" style="max-width: 250px;">
                    <code>${escapeHtml(requestStr)}</code>
                </td>
                <td class="json-cell text-truncate" style="max-width: 250px;">
                    <code>${escapeHtml(responseStr)}</code>
                </td>
            </tr>
        `);
    });
}

function showApiDetail(index) {
    const item = apiHistory[index];
    const apiName = API.getName(item.apiId);
    $('#detail-api-id').text(item.apiId);
    $('#detail-api-name').text(apiName);
    $('#detail-timestamp').text(item.timestamp);
    $('#detail-request').text(JSON.stringify(item.request, null, 2));
    $('#detail-response').text(JSON.stringify(item.response, null, 2));
    apiDetailModal.show();
}

// ============================================
// LocalStorage
// ============================================
function saveData() {
    const data = {
        // 공통 설정값
        commonSettings: {
            region: $('#region-select').val(),
            bizCode: $('#biz-code-select').val(),
            storeCode: $('#store-select').val(),
            countryCode: $('#country-code-select').val()
        },
        products: products,
        customer: {
            name: $('#customer-name').val(),
            phone: $('#customer-phone').val(),
            email: $('#customer-email').val(),
            userNo: $('#customer-userno').val()
        },
        payment: {
            method: $('input[name="payment-method"]:checked').val(),
            cardCompany: $('#card-company').val(),
            cardInstallment: $('#card-installment').val(),
            cardPoint: $('input[name="card-point"]:checked').val(),
            bank: $('#bank').val(),
            keyinCardNumber: $('#keyin-card-number').val(),
            keyinExpMonth: $('#keyin-exp-month').val(),
            keyinExpYear: $('#keyin-exp-year').val(),
            tokenBillingKey: $('#token-billing-key').val()
        }
    };
    localStorage.setItem('paymentOrderData', JSON.stringify(data));
}

function loadSavedData() {
    const savedData = localStorage.getItem('paymentOrderData');
    if (!savedData) return;

    try {
        const data = JSON.parse(savedData);

        // 공통 설정값 복원 (각 드롭다운은 독립적으로 처리)
        if (data.commonSettings) {
            // 권역 설정
            if (data.commonSettings.region) {
                $('#region-select').val(data.commonSettings.region);
            }
            // 사업부 코드 설정
            if (data.commonSettings.bizCode) {
                $('#biz-code-select').val(data.commonSettings.bizCode);
            }
            // 국가 코드 설정
            if (data.commonSettings.countryCode) {
                $('#country-code-select').val(data.commonSettings.countryCode);
            }
            // 스토어 선택 (권역과 무관하게 직접 선택)
            if (data.commonSettings.storeCode) {
                $('#store-select').val(data.commonSettings.storeCode);
                onStoreChange(data.commonSettings.storeCode);
            }
        }

        if (data.products && Array.isArray(data.products)) {
            products = data.products;
        }

        if (data.customer) {
            $('#customer-name').val(data.customer.name || '');
            $('#customer-phone').val(data.customer.phone || '');
            $('#customer-email').val(data.customer.email || '');
            $('#customer-userno').val(data.customer.userNo || '');
        }

        if (data.payment) {
            // 결제수단은 스토어 선택 후 동적으로 생성되므로 약간의 딜레이 필요
            setTimeout(() => {
                $(`input[name="payment-method"][value="${data.payment.method}"]`).prop('checked', true);
                updatePaymentOptionDisplay();
            }, 100);
            $('#card-company').val(data.payment.cardCompany || '');
            $('#card-installment').val(data.payment.cardInstallment || '0');
            if (data.payment.cardPoint) {
                $(`input[name="card-point"][value="${data.payment.cardPoint}"]`).prop('checked', true);
            }
            $('#bank').val(data.payment.bank || '');
            $('#keyin-card-number').val(data.payment.keyinCardNumber || '');
            $('#keyin-exp-month').val(data.payment.keyinExpMonth || '');
            $('#keyin-exp-year').val(data.payment.keyinExpYear || '');
            $('#token-billing-key').val(data.payment.tokenBillingKey || '');
        }
    } catch (e) {
        console.error('Failed to load saved data:', e);
    }
}

// ============================================
// Token Payment (인증/승인 분리 없이 바로 결제)
// ============================================

/**
 * 토큰 결제 처리
 * 인증/승인 분리 없이 토큰으로 바로 결제 완료
 */
function processTokenPayment(orderData, paymentData) {
    const orderId = 'ORD' + Date.now();

    // 금액 합계 계산
    const productAmount = products.reduce((sum, p) => sum + p.price, 0);
    const shippingAmount = products.reduce((sum, p) => sum + p.shipping, 0);
    const totalAmount = productAmount + shippingAmount;

    // 대표상품명 생성
    const representProductName = getRepresentProductName(products);

    // 공통 설정값 조회
    const commonSettings = getCommonSettings();

    // 시뮬레이션: 서버에서 발급하는 주문번호
    const serverOrdNo = 'ORD' + Date.now() + Math.random().toString(36).slice(2, 6).toUpperCase();

    const tokenPayRequestData = {
        // 공통 설정값
        storeCode: commonSettings.storeCode,
        region: commonSettings.region,
        countryCode: commonSettings.countryCode,
        bizCode: commonSettings.bizCode,
        // 주문 정보
        orderId: orderId,
        representProductName: representProductName,
        productAmount: productAmount,
        shippingAmount: shippingAmount,
        totalAmount: totalAmount,
        orderData: orderData,
        // 토큰 결제 정보
        userNo: orderData.userNo,
        tokenId: paymentData.tokenId,
        tokenName: paymentData.tokenName
    };

    // 시뮬레이션: 토큰 결제 API 응답 (바로 결제 완료)
    const tokenPayResponseData = {
        billing: {
            resultCode: '0',
            ordNo: serverOrdNo,
            orderId: orderId,
            transactionId: 'TXN' + Date.now(),
            approvalNumber: 'APR' + Math.random().toString(36).slice(2, 8).toUpperCase(),
            approvalDate: new Date().toISOString(),
            paymentMethod: 'TOKEN',
            tokenId: paymentData.tokenId,
            tokenName: paymentData.tokenName,
            totalAmount: totalAmount,
            message: '토큰 결제가 완료되었습니다.'
        }
    };

    addApiHistory('TOKEN_PAY001', tokenPayRequestData, tokenPayResponseData);

    const billing = tokenPayResponseData.billing;
    if (billing.resultCode !== '0') {
        showToast(billing.errMsg || '토큰 결제에 실패했습니다.', 'danger');
        return;
    }

    // 주문 정보 저장
    currentOrder = {
        ordNo: billing.ordNo,
        orderId: billing.orderId,
        pgId: null,
        pgName: '토큰결제'
    };

    // 결제 완료 처리
    paidProducts = [...products];

    if ($('#save-info').is(':checked')) {
        saveData();
    }

    showToast(`토큰 결제가 완료되었습니다. 승인번호: ${billing.approvalNumber}`, 'success');

    // 토큰 비밀번호 확인 상태 초기화
    isTokenPasswordVerified = false;
    selectedToken = null;
    updateTokenPasswordSection();
}

// ============================================
// Token Management
// ============================================

/**
 * 토큰 목록 조회
 */
function loadTokenList() {
    const userNo = $('#customer-userno').val().trim();
    if (!userNo) {
        showToast('토큰 조회를 위해 userNo를 입력해주세요.', 'warning');
        $('#no-tokens-message').show();
        $('#token-list').empty();
        return;
    }

    const requestData = {
        userNo: userNo
    };

    // 시뮬레이션: 토큰 목록 조회 API 응답
    // 실제로는 서버에서 해당 userNo의 토큰 목록을 조회
    const storedTokens = localStorage.getItem(`tokens_${userNo}`);
    const tokens = storedTokens ? JSON.parse(storedTokens) : [];

    const responseData = {
        billing: {
            resultCode: '0',
            tokens: tokens
        }
    };

    addApiHistory('TOKEN001', requestData, responseData);

    if (responseData.billing.resultCode !== '0') {
        showToast(responseData.billing.errMsg || '토큰 목록 조회에 실패했습니다.', 'danger');
        return;
    }

    userTokens = responseData.billing.tokens;
    renderTokenList();
}

/**
 * 토큰 목록 렌더링
 */
function renderTokenList() {
    const $list = $('#token-list');
    const $noMessage = $('#no-tokens-message');
    $list.empty();

    if (userTokens.length === 0) {
        $noMessage.show();
        return;
    }

    $noMessage.hide();
    userTokens.forEach(token => {
        const isSelected = selectedToken && selectedToken.tokenId === token.tokenId;
        const hasPassword = token.hasPassword;
        const maskedCard = token.cardNumber.replace(/(\d{4})-(\d{4})-(\d{4})-(\d{4})/, '$1-****-****-$4');

        $list.append(`
            <div class="token-item ${isSelected ? 'selected' : ''}" data-token-id="${token.tokenId}">
                <div class="token-item-content">
                    <div class="token-item-main">
                        <div class="token-name">${escapeHtml(token.name)}</div>
                        <div class="token-card-info">
                            <span class="card-number">${maskedCard}</span>
                            <span class="exp-date">${token.expMonth}/${token.expYear}</span>
                        </div>
                    </div>
                    <div class="token-item-badges">
                        ${hasPassword ? '<span class="badge bg-success"><i class="bi bi-lock-fill"></i> 비밀번호</span>' : '<span class="badge bg-secondary"><i class="bi bi-unlock"></i> 미설정</span>'}
                    </div>
                </div>
                <div class="token-item-actions">
                    <button type="button" class="btn btn-outline-primary btn-sm btn-set-token-password" data-token-id="${token.tokenId}" title="비밀번호 설정">
                        <i class="bi bi-lock"></i>
                    </button>
                    <button type="button" class="btn btn-outline-danger btn-sm btn-delete-token" data-token-id="${token.tokenId}" title="삭제">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            </div>
        `);
    });

    // 선택된 토큰이 있으면 비밀번호 섹션 업데이트
    updateTokenPasswordSection();
}

/**
 * 토큰 선택
 */
function selectToken(tokenId) {
    selectedToken = userTokens.find(t => t.tokenId === tokenId) || null;
    isTokenPasswordVerified = false;

    // UI 업데이트
    $('.token-item').removeClass('selected');
    $(`.token-item[data-token-id="${tokenId}"]`).addClass('selected');

    updateTokenPasswordSection();
}

/**
 * 토큰 비밀번호 섹션 업데이트
 */
function updateTokenPasswordSection() {
    const $section = $('#token-password-section');
    const $status = $('#token-password-status');
    $('#token-password-input').val('');
    $status.empty();

    if (!selectedToken) {
        $section.hide();
        return;
    }

    if (selectedToken.hasPassword) {
        $section.show();
        if (isTokenPasswordVerified) {
            $status.html('<span class="text-success"><i class="bi bi-check-circle me-1"></i>비밀번호가 확인되었습니다.</span>');
        }
    } else {
        $section.hide();
    }
}

/**
 * 토큰 등록 모달 열기
 */
function openTokenRegisterModal() {
    const userNo = $('#customer-userno').val().trim();
    if (!userNo) {
        showToast('토큰 등록을 위해 userNo를 먼저 입력해주세요.', 'warning');
        $('#customer-userno').focus();
        return;
    }

    // 폼 초기화
    $('#new-token-name').val('');
    $('#new-token-card-number').val('');
    $('#new-token-exp-month').val('');
    $('#new-token-exp-year').val('');

    tokenRegisterModal.show();
}

/**
 * 토큰 등록
 */
function registerToken() {
    const userNo = $('#customer-userno').val().trim();
    const tokenName = $('#new-token-name').val().trim();
    const cardNumber = $('#new-token-card-number').val().trim();
    const expMonth = $('#new-token-exp-month').val();
    const expYear = $('#new-token-exp-year').val();

    // 유효성 검사
    if (!tokenName) {
        showToast('토큰명을 입력해주세요.', 'warning');
        $('#new-token-name').focus();
        return;
    }
    if (!cardNumber || cardNumber.replace(/-/g, '').length !== 16) {
        showToast('올바른 카드번호를 입력해주세요.', 'warning');
        $('#new-token-card-number').focus();
        return;
    }
    if (!expMonth) {
        showToast('유효월을 선택해주세요.', 'warning');
        return;
    }
    if (!expYear) {
        showToast('유효년도를 선택해주세요.', 'warning');
        return;
    }

    const requestData = {
        userNo: userNo,
        tokenName: tokenName,
        cardNumber: cardNumber,
        expMonth: expMonth,
        expYear: expYear
    };

    // 시뮬레이션: 토큰 등록 API 응답
    const newToken = {
        tokenId: 'TKN_' + Date.now(),
        name: tokenName,
        cardNumber: cardNumber,
        expMonth: expMonth,
        expYear: expYear,
        hasPassword: false,
        createdAt: new Date().toISOString()
    };

    // LocalStorage에 저장 (시뮬레이션)
    const storedTokens = localStorage.getItem(`tokens_${userNo}`);
    const tokens = storedTokens ? JSON.parse(storedTokens) : [];
    tokens.push(newToken);
    localStorage.setItem(`tokens_${userNo}`, JSON.stringify(tokens));

    const responseData = {
        billing: {
            resultCode: '0',
            tokenId: newToken.tokenId,
            message: '토큰이 등록되었습니다.'
        }
    };

    addApiHistory('TOKEN002', requestData, responseData);

    if (responseData.billing.resultCode !== '0') {
        showToast(responseData.billing.errMsg || '토큰 등록에 실패했습니다.', 'danger');
        return;
    }

    tokenRegisterModal.hide();
    showToast('토큰이 등록되었습니다.', 'success');
    loadTokenList();
}

/**
 * 토큰 비밀번호 설정 모달 열기
 */
function openTokenPasswordModal(tokenId) {
    const token = userTokens.find(t => t.tokenId === tokenId);
    if (!token) {
        showToast('토큰을 찾을 수 없습니다.', 'danger');
        return;
    }

    passwordTargetToken = token;
    const maskedCard = token.cardNumber.replace(/(\d{4})-(\d{4})-(\d{4})-(\d{4})/, '$1-****-****-$4');
    $('#password-token-info').text(`${token.name} (${maskedCard})`);
    $('#set-token-password').val('');
    $('#confirm-token-password').val('');

    tokenPasswordModal.show();
}

/**
 * 토큰 비밀번호 설정
 */
function setTokenPassword() {
    if (!passwordTargetToken) {
        showToast('토큰 정보가 없습니다.', 'danger');
        return;
    }

    const password = $('#set-token-password').val();
    const confirmPassword = $('#confirm-token-password').val();

    if (!password || password.length !== 6) {
        showToast('비밀번호는 숫자 6자리여야 합니다.', 'warning');
        $('#set-token-password').focus();
        return;
    }
    if (password !== confirmPassword) {
        showToast('비밀번호가 일치하지 않습니다.', 'warning');
        $('#confirm-token-password').focus();
        return;
    }

    const userNo = $('#customer-userno').val().trim();
    const requestData = {
        userNo: userNo,
        tokenId: passwordTargetToken.tokenId,
        password: '******' // 보안상 마스킹
    };

    // 시뮬레이션: 비밀번호 설정
    const storedTokens = localStorage.getItem(`tokens_${userNo}`);
    const tokens = storedTokens ? JSON.parse(storedTokens) : [];
    const tokenIndex = tokens.findIndex(t => t.tokenId === passwordTargetToken.tokenId);
    if (tokenIndex !== -1) {
        tokens[tokenIndex].hasPassword = true;
        tokens[tokenIndex].password = password; // 실제로는 서버에서 암호화 저장
        localStorage.setItem(`tokens_${userNo}`, JSON.stringify(tokens));
    }

    const responseData = {
        billing: {
            resultCode: '0',
            message: '비밀번호가 설정되었습니다.'
        }
    };

    addApiHistory('TOKEN003', requestData, responseData);

    if (responseData.billing.resultCode !== '0') {
        showToast(responseData.billing.errMsg || '비밀번호 설정에 실패했습니다.', 'danger');
        return;
    }

    tokenPasswordModal.hide();
    passwordTargetToken = null;
    showToast('토큰 비밀번호가 설정되었습니다.', 'success');
    loadTokenList();
}

/**
 * 토큰 삭제
 */
function deleteToken(tokenId) {
    const token = userTokens.find(t => t.tokenId === tokenId);
    if (!token) {
        showToast('토큰을 찾을 수 없습니다.', 'danger');
        return;
    }

    if (!confirm(`'${token.name}' 토큰을 삭제하시겠습니까?`)) {
        return;
    }

    const userNo = $('#customer-userno').val().trim();
    const requestData = {
        userNo: userNo,
        tokenId: tokenId
    };

    // 시뮬레이션: 토큰 삭제
    const storedTokens = localStorage.getItem(`tokens_${userNo}`);
    const tokens = storedTokens ? JSON.parse(storedTokens) : [];
    const filteredTokens = tokens.filter(t => t.tokenId !== tokenId);
    localStorage.setItem(`tokens_${userNo}`, JSON.stringify(filteredTokens));

    const responseData = {
        billing: {
            resultCode: '0',
            message: '토큰이 삭제되었습니다.'
        }
    };

    addApiHistory('TOKEN004', requestData, responseData);

    if (responseData.billing.resultCode !== '0') {
        showToast(responseData.billing.errMsg || '토큰 삭제에 실패했습니다.', 'danger');
        return;
    }

    // 선택된 토큰이 삭제된 경우 초기화
    if (selectedToken && selectedToken.tokenId === tokenId) {
        selectedToken = null;
        isTokenPasswordVerified = false;
    }

    showToast('토큰이 삭제되었습니다.', 'success');
    loadTokenList();
}

/**
 * 토큰 비밀번호 확인
 */
function verifyTokenPassword() {
    if (!selectedToken) {
        showToast('토큰을 선택해주세요.', 'warning');
        return;
    }

    const password = $('#token-password-input').val();
    if (!password || password.length !== 6) {
        showToast('비밀번호 6자리를 입력해주세요.', 'warning');
        $('#token-password-input').focus();
        return;
    }

    const userNo = $('#customer-userno').val().trim();
    const requestData = {
        userNo: userNo,
        tokenId: selectedToken.tokenId,
        password: '******'
    };

    // 시뮬레이션: 비밀번호 확인
    const storedTokens = localStorage.getItem(`tokens_${userNo}`);
    const tokens = storedTokens ? JSON.parse(storedTokens) : [];
    const token = tokens.find(t => t.tokenId === selectedToken.tokenId);
    const isValid = token && token.password === password;

    const responseData = {
        billing: {
            resultCode: isValid ? '0' : '1',
            errMsg: isValid ? null : '비밀번호가 일치하지 않습니다.'
        }
    };

    addApiHistory('TOKEN005', requestData, responseData);

    if (responseData.billing.resultCode !== '0') {
        showToast(responseData.billing.errMsg || '비밀번호 확인에 실패했습니다.', 'danger');
        $('#token-password-status').html('<span class="text-danger"><i class="bi bi-x-circle me-1"></i>비밀번호가 일치하지 않습니다.</span>');
        return;
    }

    isTokenPasswordVerified = true;
    $('#token-password-status').html('<span class="text-success"><i class="bi bi-check-circle me-1"></i>비밀번호가 확인되었습니다.</span>');
    showToast('비밀번호가 확인되었습니다.', 'success');
}
