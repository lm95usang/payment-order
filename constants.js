/**
 * 내부 테스트용 결제 주문서 - 상수 정의
 */

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
        { id: 'CANCEL002', name: '부분 취소', url: '/api/payment/partial-cancel', method: 'POST' }
    ],
    getById(apiId) {
        return this.list.find(api => api.id === apiId) || null;
    },
    getName(apiId) {
        const api = this.getById(apiId);
        return api ? api.name : apiId;
    }
};
