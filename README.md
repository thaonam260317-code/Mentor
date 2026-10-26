# Mentor Đầu Tư

App web cá nhân để quản lý danh mục chứng khoán, vàng, gửi tiết kiệm, bất động sản và tiền mặt, lập kế hoạch giao dịch và nhận lời nhắc kiểu mentor. Cài được như app trên điện thoại (PWA), tối ưu cho Galaxy Z Fold: màn hình ngoài có tab dưới đáy, màn hình trong có thanh bên và 2 cột.

- **Dữ liệu chỉ lưu trên máy** (localStorage). Repo không chứa số liệu cá nhân nào. Dùng *Mục tiêu → Sao lưu ra file* để giữ bản dự phòng hoặc chuyển máy.
- **Giá cổ phiếu**: workflow `update-prices.yml` chạy 10:07, 12:07, 14:07, 15:07 (giờ VN) các ngày thứ 2–6, ghi `data/prices.json`; app tự đọc khi mở. Thêm mã muốn lấy giá trong phiên vào `data/tickers.json` (giá đóng cửa của toàn thị trường được lấy sẵn).
- **Hỏi mentor AI** (tùy chọn): nhập API key Claude ở tab Mục tiêu. Key chỉ lưu trên máy và gửi thẳng tới Anthropic.

## Cấu trúc

| File | Vai trò |
|---|---|
| `index.html` | Toàn bộ app (HTML, CSS, JS) |
| `sw.js`, `manifest.webmanifest`, `icons/` | Cài đặt như app, chạy offline |
| `scripts/fetch-prices.mjs` | Lấy giá từ VPS / VNDirect / TCBS |
| `data/prices.json` | Giá mới nhất, do workflow cập nhật |
| `data/tickers.json` | Các mã cần giá trong phiên |

Chạy thử trên máy: `python3 -m http.server` rồi mở http://localhost:8000.
