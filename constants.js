/**
 * 내부 테스트용 결제 주문서 - 상수 정의
 */

// ============================================
// 권역 (Region) 정의
// ============================================
const REGION = {
    KIC: { id: 'KIC', name: '한국 권역', description: 'Korea Internet Center' },
    EIC: { id: 'EIC', name: '유럽 권역', description: 'Europe Internet Center' },
    AIC: { id: 'AIC', name: '아시아 권역', description: 'Asia Internet Center' }
};

// ============================================
// 결제 수단 정의
// ============================================
const PAYMENT_METHOD = {
    // 결제 수단 목록
    list: [
        { id: 'CARD', code: 'PM001', name: '신용카드', icon: 'bi-credit-card', hasOption: true },
        { id: 'VBANK', code: 'PM002', name: '가상계좌', icon: 'bi-bank', hasOption: true },
        { id: 'NAVERPAY', code: 'PM003', name: '네이버페이', icon: 'bi-n-circle', hasOption: false },
        { id: 'TOSSPAY', code: 'PM004', name: '토스페이', icon: 'bi-t-square', hasOption: false },
        { id: 'KAKAOPAY', code: 'PM005', name: '카카오페이', icon: 'bi-chat-fill', hasOption: false },
        { id: 'PAYCO', code: 'PM006', name: '페이코', icon: 'bi-p-circle', hasOption: false },
        { id: 'KEYIN', code: 'PM007', name: 'Key-In 결제', icon: 'bi-keyboard', hasOption: true },
        { id: 'BANK_TRANSFER', code: 'PM008', name: '계좌즉시이체', icon: 'bi-arrow-left-right', hasOption: false },
        { id: 'APPLEPAY', code: 'PM009', name: 'Apple Pay', icon: 'bi-apple', hasOption: false },
        { id: 'GOOGLEPAY', code: 'PM010', name: 'Google Pay', icon: 'bi-google', hasOption: false },
        { id: 'TOKEN', code: 'PM011', name: '토큰결제', icon: 'bi-key', hasOption: true },
        { id: 'PAYPAL', code: 'PM012', name: 'PayPal', icon: 'bi-paypal', hasOption: false }
    ],
    getById(methodId) {
        return this.list.find(m => m.id === methodId) || null;
    },
    getName(methodId) {
        const method = this.getById(methodId);
        return method ? method.name : methodId;
    },
    getByIds(methodIds) {
        return this.list.filter(m => methodIds.includes(m.id));
    }
};

// ============================================
// 스토어 정의
// ============================================
const STORE = {
    list: [
        // 한국 스토어
        {
            code: 'SVC5013',
            name: 'LGE.COM',
            paymentMethods: ['CARD', 'VBANK', 'NAVERPAY', 'TOSSPAY', 'KAKAOPAY', 'PAYCO', 'BANK_TRANSFER']
        },
        {
            code: 'SVC501',
            name: 'CSMS',
            paymentMethods: ['CARD', 'VBANK', 'NAVERPAY', 'TOSSPAY', 'KAKAOPAY', 'PAYCO', 'KEYIN', 'BANK_TRANSFER', 'TOKEN']
        },
        {
            code: 'SVC30101',
            name: 'LGAppsTV',
            paymentMethods: ['CARD', 'VBANK', 'NAVERPAY', 'KAKAOPAY', 'BANK_TRANSFER']
        },
        {
            code: 'SVC30102',
            name: 'SHOPTIME',
            paymentMethods: ['CARD', 'VBANK', 'NAVERPAY', 'TOSSPAY', 'KAKAOPAY', 'PAYCO', 'TOKEN']
        },
        {
            code: 'SVC30103',
            name: 'LG Gallery+',
            paymentMethods: ['CARD', 'PAYPAL', 'APPLEPAY', 'GOOGLEPAY']
        },
        {
            code: 'EU_UK',
            name: '영국몰',
            paymentMethods: ['CARD', 'PAYPAL', 'APPLEPAY', 'GOOGLEPAY']
        },
        {
            code: 'EU_FR',
            name: '프랑스몰',
            paymentMethods: ['CARD', 'PAYPAL', 'APPLEPAY']
        },
        {
            code: 'CN_MAIN',
            name: '중국 메인몰',
            paymentMethods: ['CARD', 'PAYPAL', 'TOKEN']
        },
        {
            code: 'JP_MAIN',
            name: '일본 메인몰',
            paymentMethods: ['CARD', 'APPLEPAY', 'GOOGLEPAY', 'PAYPAL']
        },
        {
            code: 'SG_MAIN',
            name: '싱가포르몰',
            paymentMethods: ['CARD', 'PAYPAL', 'APPLEPAY', 'GOOGLEPAY']
        }
    ],
    getByCode(storeCode) {
        return this.list.find(s => s.code === storeCode) || null;
    },
    getPaymentMethods(storeCode) {
        const store = this.getByCode(storeCode);
        if (!store) return [];
        return PAYMENT_METHOD.getByIds(store.paymentMethods);
    },
    getAllRegions() {
        return Object.values(REGION);
    }
};

// ============================================
// 국가 코드 정의
// ============================================
const COUNTRY = {
    list: [
        { code: 'KR', name: '대한민국' },
        { code: 'US', name: '미국' },
        { code: 'JP', name: '일본' },
        { code: 'CN', name: '중국' },
        { code: 'DE', name: '독일' },
        { code: 'GB', name: '영국' },
        { code: 'FR', name: '프랑스' },
        { code: 'SG', name: '싱가포르' },
        { code: 'HK', name: '홍콩' },
        { code: 'TW', name: '대만' }
    ],
    getByCode(code) {
        return this.list.find(c => c.code === code) || null;
    },
    getName(code) {
        const country = this.getByCode(code);
        return country ? country.name : code;
    }
};

// ============================================
// 사업부 코드 정의
// ============================================
const BIZ_CODE = {
    list: [
        { code: 'KM', name: '한국영업본부' },
        { code: 'BS', name: 'BS사업부' },
        { code: 'HE', name: 'TV사업부' },
        { code: 'GB', name: '해외영업본부' },
        { code: 'MC', name: 'Mobile사업부' }
    ],
    getByCode(code) {
        return this.list.find(b => b.code === code) || null;
    },
    getName(code) {
        const biz = this.getByCode(code);
        return biz ? biz.name : code;
    }
};

// ============================================
// 기본값 설정
// ============================================
// 기본 상품 값
const DEFAULT_PRODUCT = {
    id: 'PROD_',
    name: '상품',
    price: 1000,
    shipping: 0,
    deliveryGroup: 'A01',
    sellerNo: 'TEST01'
};

// 기본 배송비 상품 값 (부분취소 시 추가 배송비 상품)
const DEFAULT_SHIPPING_PRODUCT = {
    id: 'DLVR_',
    name: '배송비',
    fee: 3000,
    deliveryGroup: 'A01',
    sellerNo: 'TEST01'
};

// 결제창 오픈 타입
const WINDOW_TYPE = {
    SCRIPT: 'SCRIPT',   // JavaScript SDK 호출 방식 (A PG사)
    REDIRECT: 'REDIRECT' // URL 리다이렉트 방식 (B PG사)
};

// PG사 정의
const PG = {
    list: [
        {
            id: 'PG_A',
            name: 'A PG사',
            windowType: WINDOW_TYPE.SCRIPT,
            scriptUrl: 'https://pg-a.example.com/sdk.js',
            description: 'JavaScript SDK 방식'
        },
        {
            id: 'PG_B',
            name: 'B PG사',
            windowType: WINDOW_TYPE.REDIRECT,
            description: 'URL 리다이렉트 방식'
        }
    ],
    getById(pgId) {
        return this.list.find(pg => pg.id === pgId) || null;
    },
    getName(pgId) {
        const pg = this.getById(pgId);
        return pg ? pg.name : pgId;
    }
};

// API 정의
const API = {
    list: [
        { id: 'AUTH001', name: '결제 인증 요청', url: '/api/payment/auth', method: 'POST' },
        { id: 'APPROVE001', name: '결제 승인 요청', url: '/api/payment/approve', method: 'POST' },
        { id: 'DEPOSIT001', name: '입금완료', url: '/api/payment/deposit', method: 'POST' },
        { id: 'CANCEL001', name: '전체 취소', url: '/api/payment/cancel', method: 'POST' },
        { id: 'CANCEL002', name: '부분 취소', url: '/api/payment/partial-cancel', method: 'POST' },
        // 토큰 관리 API
        { id: 'TOKEN001', name: '토큰 목록 조회', url: '/api/token/list', method: 'GET' },
        { id: 'TOKEN002', name: '토큰 등록', url: '/api/token/register', method: 'POST' },
        { id: 'TOKEN003', name: '토큰 비밀번호 등록', url: '/api/token/password', method: 'POST' },
        { id: 'TOKEN004', name: '토큰 삭제', url: '/api/token/delete', method: 'DELETE' },
        { id: 'TOKEN005', name: '토큰 비밀번호 확인', url: '/api/token/verify-password', method: 'POST' },
        // 토큰 결제 API (인증/승인 분리 없이 바로 결제)
        { id: 'TOKEN_PAY001', name: '토큰 결제', url: '/api/token/pay', method: 'POST' }
    ],
    getById(apiId) {
        return this.list.find(api => api.id === apiId) || null;
    },
    getName(apiId) {
        const api = this.getById(apiId);
        return api ? api.name : apiId;
    }
};
