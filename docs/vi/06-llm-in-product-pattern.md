# 06. Pattern: gọi LLM bên trong sản phẩm

## Mục đích

Một số feature có thể dùng LLM lúc runtime, ví dụ:

- gợi ý mapping thuộc tính sản phẩm giữa các kênh,
- chuẩn hoá địa chỉ hoặc tên option lộn xộn,
- đề xuất ghép danh mục (category),
- soạn thay đổi listing hàng loạt từ chỉ dẫn của merchant.

Tài liệu này quy định pattern duy nhất ta dùng cho những feature như vậy. Model đề xuất; code tất định kiểm tra; con người phê duyệt; code service hiện có áp dụng; mọi thứ đều được ghi log và có thể revert.

## Khi nào KHÔNG dùng LLM

Không dùng LLM khi:

- Một rule tất định, bảng tra, regex hoặc parser làm được việc một cách tin cậy. Thử cách đó trước; chỉ dùng LLM cho phần còn lại mà nó không xử lý được.
- Kết quả phải chính xác tuyệt đối và đằng nào code cũng kiểm tra được (tổng tiền, phép tính tồn kho, thuế).
- Thao tác không thể đảo ngược hoặc ảnh hưởng tài chính trực tiếp (hoàn tiền, đổi giá mà không review, huỷ đơn).
- Input sẽ chứa dữ liệu cá nhân hoặc secret và không thể cắt bớt hoặc che đi.
- Không có người để phê duyệt thay đổi trong thời gian yêu cầu.
- Khách hàng chưa đồng ý cho AI xử lý dữ liệu của họ.

## Pattern

```text
User request / source data
        │
        ▼
 1. Prepare input (minimise, mask personal data)
        │
        ▼
 2. LLM proposes changes as structured JSON
        │
        ▼
 3. Deterministic validator ──fail──► one repair round ──fail──► reject, show reason
        │ pass
        ▼
 4. Human reviews each change (before / after), approves or rejects
        │ approved
        ▼
 5. Staleness check (data unchanged since "before" was read?)
        │ ok
        ▼
 6. Apply through existing service code (same validation, transactions, events)
        │
        ▼
 7. Audit log + revert
```

### 1. Chuẩn bị input

- Chỉ gửi các field cần cho task. Không gửi tên, số điện thoại, email hay địa chỉ khách hàng, trừ khi feature thực sự cần và đã được security owner phê duyệt.
- Thay định danh bằng mã tham chiếu ngắn local (`item_1`, `item_2`) và giữ bảng mapping ở phía ta.
- Đặt giới hạn kích thước cho input. Tập dữ liệu lớn thì chia batch.

### 2. LLM đề xuất dưới dạng JSON có cấu trúc

- Model chỉ trả về JSON, khớp với một schema chặt. Văn bản tự do không bao giờ được thực thi hay áp dụng.
- Schema có **tập loại thay đổi đóng**, ví dụ `set_attribute`, `map_category`, `rename_option`. Không chấp nhận gì ngoài tập này.
- Mỗi thay đổi trỏ tới đối tượng bằng mã tham chiếu ở bước 1 và đưa ra giá trị mới đề xuất.
- Model không cung cấp giá trị "before". Ta tự đọc giá trị đó (bước 4).

Ví dụ schema (rút gọn):

```json
{
  "changes": [
    {
      "type": "map_category",
      "target": "item_3",
      "value": { "channelCategoryId": "100234" },
      "reason": "short explanation"
    }
  ]
}
```

### 3. Validator tất định

Validator là code TypeScript bình thường, có unit test. Nó kiểm tra:

- **Schema:** JSON parse được và khớp chính xác với schema. Field lạ bị từ chối.
- **Tập đóng:** `type` thuộc các loại thay đổi được phép.
- **ID có thật:** mọi `target` map tới một bản ghi có thật mà user được phép sửa (kiểm tra tenant). Mọi giá trị được tham chiếu (category ID, attribute ID) có tồn tại trong dữ liệu của ta hoặc catalogue của kênh đã cache.
- **Giới hạn:** độ dài, khoảng giá trị số, ký tự cho phép, số thay đổi tối đa mỗi request.
- **Business rule:** chính các rule mà service bình thường áp dụng (ví dụ giá không bao giờ được đổi qua luồng này).
- **Dựng lại output:** validator tạo một object thay đổi mới chỉ từ các field đã được kiểm tra. Output thô của model không bao giờ được chuyển tiếp.

**Một vòng sửa duy nhất:** nếu validate thất bại, gửi cho model danh sách lỗi validate một lần và yêu cầu JSON đã sửa. Nếu vẫn thất bại, từ chối request và hiển thị lý do cho user. Không lặp.

### 4. Con người phê duyệt từng thay đổi

- Hiển thị mỗi thay đổi dạng **before → after**. "Before" được đọc từ database của ta ngay lúc đó, không bao giờ lấy từ model.
- User phê duyệt hoặc từ chối từng thay đổi. Chỉ được phê duyệt hàng loạt khi toàn bộ danh sách đang hiển thị.
- Hiển thị lý do ngắn của model, ghi rõ là do AI tạo ra.

### 5. Staleness check

- Khi user phê duyệt, so sánh giá trị hiện tại với giá trị "before" đã hiển thị (hoặc dùng cột version).
- Nếu dữ liệu đã thay đổi trong lúc đó, không áp dụng. Hiển thị trạng thái mới và hỏi lại.

### 6. Áp dụng qua code service hiện có

- Thay đổi đã duyệt đi qua đúng các method service mà một thao tác user bình thường sử dụng: validate, phân quyền, transaction, domain event và đồng bộ kênh.
- Không có "đường ghi dành riêng cho AI" vào database.

### 7. Audit log và revert

Ghi log cho mỗi thay đổi:

- ai yêu cầu và ai phê duyệt,
- model và version của prompt,
- thay đổi đã được validate,
- giá trị before và after,
- các mốc thời gian.

Không ghi log prompt thô nếu nó chứa dữ liệu khách hàng. Mọi thay đổi đã áp dụng đều có thể revert từ bản ghi audit thông qua cùng code service.

## Chi phí và độ tin cậy

- Chọn model nhỏ nhất đạt chất lượng yêu cầu trên một bộ test; đo đạc trước khi chuyển sang model lớn hơn.
- Đặt budget cho mỗi request và mỗi tenant. Dừng và báo cáo khi vượt.
- Chỉ retry với lỗi tạm thời (timeout, 429, 5xx), có backoff và giới hạn số lần.
- Dùng prompt caching cho system prompt dài, ổn định và phần context catalogue.
- Giữ một bộ test gồm các case có hình dạng như thật (dữ liệu giả lập). Chạy nó trong CI khi prompt, model hoặc schema thay đổi, và theo dõi tỉ lệ được chấp nhận.

## Checklist trước khi release

- [ ] Đã thử cách tất định trước; LLM chỉ xử lý phần còn lại.
- [ ] Security owner đã duyệt dữ liệu gửi cho model.
- [ ] Input đã được rút gọn và che; không có dữ liệu cá nhân nếu chưa được duyệt.
- [ ] JSON schema có tập loại thay đổi đóng.
- [ ] Validator có unit test cho mọi rule, kể cả output độc hại và sai định dạng.
- [ ] Đúng một vòng sửa.
- [ ] Giá trị before đọc từ dữ liệu của ta; có staleness check khi áp dụng.
- [ ] Con người phê duyệt từng thay đổi.
- [ ] Áp dụng qua code service hiện có.
- [ ] Audit log và revert đã được test.
- [ ] Đã cấu hình budget, timeout và retry.
- [ ] Bộ test đánh giá chạy trong CI.
