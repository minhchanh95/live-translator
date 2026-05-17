# Live Event Translator

MVP web app dùng OpenAI Realtime API + WebRTC để dịch giọng nói trực tiếp.

## Chạy local

```bash
npm install
cp .env.example .env.local
# sửa OPENAI_API_KEY trong .env.local
npm run dev
```

Mở: http://localhost:3000

## Cách hoạt động

1. Browser xin quyền microphone.
2. Browser tạo WebRTC offer và gửi SDP lên `/api/session`.
3. Next.js backend gọi OpenAI `/v1/realtime/calls` bằng `OPENAI_API_KEY`.
4. Backend trả SDP answer về browser.
5. Browser nhận realtime events qua DataChannel `oai-events` và hiển thị bản dịch.

## Lưu ý

- Không đưa `OPENAI_API_KEY` vào client.
- Nếu gặp `insufficient_quota`, cần kiểm tra Billing/Quota của OpenAI project.
- Chrome/Edge sẽ chạy ổn nhất. Với HTTPS production, quyền microphone hoạt động tốt hơn.
