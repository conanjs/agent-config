# Spec 022 (tách repo): báo cáo tiến độ và mức dùng token

Ngày đo: 2026-11-17. Nguồn số liệu: transcript của session `1923722f` (Claude Code, desktop app) và 77 transcript của các agent con, trong `~/.claude/projects/-Users-vinh-doq-workspace-agent-config/`. Cách đếm ở cuối file.

## 1. Tóm tắt

- **Tiến độ:** 142 trên 263 task đã xong (54%), còn **121 task**. Đã merge phase A, 0 và 1. Phase 2 (installer tối thiểu) xong 23 trên 40 task. Phase 3 đến 8 chưa bắt đầu.
- **Token:** khoảng **221 triệu token quy đổi**. Agent điều phối (session chính) chiếm 38%, các agent con chiếm 62%.
- **Vì sao lâu (4 nguyên nhân chính):**
  1. Phạm vi kế hoạch quá lớn so với nhu cầu.
  2. Quy trình review nhân số vòng làm lại.
  3. Session điều phối chạy liên tục 8 ngày, nên mỗi lượt phải đọc lại 300 đến 900 nghìn token.
  4. Hết quota 5 giờ làm các agent đứt giữa chừng.

## 2. Công việc nằm ở worktree nào

Worktree là một thư mục làm việc riêng của cùng một repo, mỗi thư mục giữ một branch. Ví dụ: `agent-config-022-p2` là repo agent-config đang đứng ở branch `feat/022-phase-2`.

| Worktree | Branch | Nội dung | Trạng thái |
|---|---|---|---|
| `agent-config` (chính) | `main` | Không dùng cho spec 022, chỉ có thay đổi `TRACKER.md` | **Cũ**: `main` ở máy là `91e213a`, còn GitHub đã ở `ca9d49a` (có phase 0 và 1). Cần `git pull` |
| `agent-config-022` | `feat/022-repo-split` | Phase A và 0 | Đã merge (PR #31), có thể xoá |
| `agent-config-022-p1` | `feat/022-phase-1` | Phase 1 | Đã merge (PR #32), có thể xoá |
| `agent-config-022-p2` | `feat/022-phase-2` | Phase 2 | **Đang làm.** T117 đến T137 đã commit và push (`f22b78e`); T138 chưa commit (42 file) |
| `efficiency-auditor-538525` | `claude/cache-rebuild-plan` | Việc khác (PR #24) | Không liên quan spec 022 |
| `lucid-poincare-75cd8a` | `claude/lucid-poincare-75cd8a` | Session khác | Không liên quan spec 022 |

## 3. Tiến độ theo phase

| Phase | Mục tiêu | Xong | Còn |
|---|---|---|---|
| A | Sửa spec sau G3, chuyển sang Node 24 | 41 | 0 |
| 0 | Contract, công cụ kiểm tra, CI | 51 | 3 (cần máy Windows: T044, T088, T089) |
| 1 | Cắt vòng phụ thuộc (cut the cycles) | 27 | 0 |
| 2 | Installer tối thiểu | 23 | 17 |
| 3 | Tách company KB sang repo `agent-companies` | 0 | 14 |
| 4 | Bước build và đích theo từng mục | 0 | 24 |
| 5 | Installer đầy đủ | 0 | 28 |
| 6 | Tách knowledge base sang repo `agent-knowledge` | 0 | 16 |
| 7 | Tách agentic-sdlc sang repo riêng | 0 | 8 |
| 8 | Bố cục thư mục | 0 | 8 |
| Z | Kiểm tra cuối | 0 | 3 |
| **Tổng** | | **142** | **121** |

Ba việc mà V thực sự muốn (tách knowledge base, tách company KB, tách agentic-sdlc) nằm ở phase 3, 6 và 7, tổng cộng **38 task**. Phase 2, 4, 5 và 8 (**77 task** còn lại) là xây installer và công cụ build.

## 4. Token đi đâu

"Token quy đổi" là một đơn vị so sánh chi phí: input × 1 + cache write × 2 + cache read × 0,1 + output × 5. Hệ số lấy theo tỉ lệ giá của Anthropic: cache 1 giờ ghi tốn 2 lần input, đọc tốn 0,1 lần, output tốn 5 lần. Đơn vị này không tính chênh lệch giá giữa các model (Opus, Sonnet, Haiku).

### 4.1 Theo người làm

| Ai | Số agent | Lượt gọi model | Token quy đổi | Tỉ lệ |
|---|---|---|---|---|
| Agent điều phối (session chính, 2026-11-09 đến 2026-11-17) | 1 | 1.449 | 83,9 triệu | 38% |
| Engineering | 25 | 1.451 | 75,3 triệu | 34% |
| QA | 21 | 1.019 | 39,1 triệu | 18% |
| Security | 4 | 199 | 10,6 triệu | 5% |
| Các vai còn lại (architecture, spec, web-fetch…) | 27 | 239 | 12,2 triệu | 5% |

### 4.2 Mười agent tốn nhất

| Token quy đổi | Lượt | Việc |
|---|---|---|
| 18,4 triệu | 266 | Engineering T138 (install và plan) |
| 15,5 triệu | 201 | Engineering T135 (module variables) |
| 13,1 triệu | 179 | Engineering T131 (module manifests) |
| 6,8 triệu | 90 | Security review T130 (ba vòng) |
| 5,0 triệu | 98 | Engineering T129/T130 (khung và module shared) |
| 4,9 triệu | 98 | QA review T129, T130, T149, T150 |
| 4,6 triệu | 100 | Engineering contracts/lib T054 đến T057 |
| 4,5 triệu | 104 | QA review contracts/lib |
| 3,7 triệu | 88 | Engineering fitness và coverage |
| 3,6 triệu | 78 | QA viết scenario consent, resolution, security |

Ba agent engineering đầu bảng (T138, T135, T131) chiếm một phần ba token của tất cả agent con.

### 4.3 Theo ngày (chỉ agent con)

2026-11-13: 15,0 triệu · 2026-11-14: 32,4 triệu · 2026-11-16: 58,8 triệu · 2026-11-17: 25,2 triệu.

## 5. Điểm tắc nghẽn (vì sao lâu)

| # | Nguyên nhân | Bằng chứng | Mức ảnh hưởng |
|---|---|---|---|
| 1 | **Phạm vi quá lớn so với nhu cầu.** Mục tiêu là tách 3 repo và gọn agent-config, nhưng kế hoạch xây một installer có độ an toàn cấp doanh nghiệp cho một người dùng | 263 task; 3.537 dòng tài liệu spec. Riêng phase 2 "tối thiểu" đã có khoảng 15.400 dòng TypeScript chạy thật, 12.000 dòng unit test, 4.400 dòng scenario (251 scenario) và 6.500 dòng code contract. Có 18 luật bảo mật (M-01 đến M-18): hash đồng ý, journal, lock, che bí mật, escape ký tự Unicode ẩn, đường firmlink của macOS, tên thiết bị Windows… | Lớn nhất |
| 2 | **Quy trình nhân số vòng.** Mỗi task gồm engineering, rồi QA review, rồi security review nếu task có nhãn `[Sec]`, rồi 1 đến 3 vòng sửa | T130 qua 3 vòng security. T133/T136 qua 2 vòng. T137 qua 1 vòng QA. T138: build, dừng, sửa, security đánh trượt, đang sửa. 83 lần gửi tin để agent làm tiếp | Lớn |
| 3 | **Session điều phối phình to.** Một session chạy 8 ngày, qua 8 lần nén (compact) | Ngữ cảnh trung bình mỗi lượt là 340 nghìn token, lên tới 700 nghìn ngày 2026-11-16, tối đa 966 nghìn. 754 trên 1.449 lượt có ngữ cảnh trên 300 nghìn. Lượt chỉ để nhận thông báo "agent xong" cũng đọc lại toàn bộ ngữ cảnh đó | Lớn (38% tổng) |
| 4 | **Viết scenario trước quá xa.** 255 scenario của phase 2 viết trước khi có code | 251 vẫn đang chờ (`@pending`) vì cần T142. Xung đột chỉ lộ ra muộn: AC-3.1 với AC-7.1, fixture thiếu `repository`, ba nhóm QA viết ba bộ câu thông báo khác nhau | Trung bình |
| 5 | **Quota 5 giờ.** Agent bị cắt giữa chừng, phải gửi tin cho chạy tiếp và đọc lại | Hết giới hạn nhiều lần; T138 lần đầu chạy 37 phút với 189 lần gọi công cụ | Trung bình (chủ yếu tốn thời gian chờ) |
| 6 | **Sự cố ngoài kế hoạch** | CI Windows lỗi 254 rồi 107 scenario; Codex treo 7,5 giờ; macOS dọn `/tmp` xoá mất worktree; ghi sai ledger | Nhỏ đến trung bình |

## 6. Đề xuất (V quyết định)

| Lựa chọn | Làm gì | Ước lượng còn lại |
|---|---|---|
| **A. Thu hẹp phạm vi (đề xuất)** | Đóng phase 2 ở mức "chạy được": T138 đến T142 cộng các script khởi chạy, bỏ hoặc hoãn security review từng task. Làm ngay phase 3, 6 và 7 (tách repo thật). Hoãn phase 4, 5 và 8 sang một spec sau, khi thật sự cần | Khoảng 45 đến 55 task |
| B. Giữ phạm vi, đổi cách làm | Giữ 121 task, nhưng: mỗi phase mở một session điều phối mới với ghi chú bàn giao ngắn; security review một lần cuối phase thay vì từng task; QA viết scenario ngay trước mỗi task; giao nhiều task nhỏ cho một agent | 121 task, nhưng ít token hơn mỗi task |
| C. Giữ nguyên | Tiếp tục như hiện nay | 121 task, mỗi task một đến vài vòng review |

Dù chọn gì, hai việc sau nên làm ngay vì không mất gì:
- Mở **session mới** cho phần tiếp theo. Session này đã lên tới 966 nghìn token ngữ cảnh, nên mỗi lượt ở đây đắt hơn nhiều so với một session mới.
- Gom security review về cuối phase.

## 7. "Cut the cycles" (phase 1) nghĩa là gì

**Không** có nghĩa là knowledge base hết tham chiếu ra ngoài. Nó nghĩa là vòng phụ thuộc hai chiều giữa knowledge base và framework agentic-sdlc đã bị cắt, chỉ còn một chiều.

Ví von: trước đây hai cuốn sách ghi chú chéo nhau ("xem sách kia, trang X"), nên không tách được cuốn nào ra khỏi kệ. Bây giờ chỉ sách agentic-sdlc ghi chú sang knowledge base. Knowledge base không nhắc tới agentic-sdlc nữa, nên mang đi chỗ khác được.

Cụ thể đã xong:
- **0 dòng** trong knowledge base nhắc tới framework agentic-sdlc (từ 123 dòng trong 73 file). Kiểm tra fitness khoá con số này ở 0 vĩnh viễn (FIT-6).
- Bỏ mục "Used by" và bỏ bước quét liên kết ngược. Trước đây mỗi tài liệu kiến thức liệt kê những luật SDLC dùng nó; đó chính là chiều phụ thuộc ngược.
- Bộ kiểm tra knowledge base chỉ đọc knowledge base, không còn đọc thư mục company.
- Ngược lại, framework agentic-sdlc vẫn trích dẫn knowledge base. Bộ kiểm tra của nó (`--knowledge`, `--adapters`, `build cite`) báo lỗi nếu một trích dẫn trỏ tới file không tồn tại.

Vẫn còn trong knowledge base, và là bình thường:
- Liên kết giữa các tài liệu trong chính knowledge base.
- Nguồn trên web: 349 file có link `https://`.
- Nhắc tới repo tham khảo riêng `conanjs/agentic-sdlc-reference-typescript-node`. Đây là một repo khác, không phải framework, và được loại trừ có chủ đích.
- Đường dẫn `{{AGENT_HOME}}/…`.

## Cách đếm

- Mỗi phản hồi của model được đếm một lần theo `message.id`. Cộng các trường `usage`: `input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`.
- Ngữ cảnh một lượt = input + cache write + cache read của lượt đó.
- Số dòng code: `wc -l` trên các file `.ts` trong `installers/core/src` (tách riêng file `.test.ts`), `tests/installer-*/*.feature` và `contracts/**/*.ts`, ở branch `feat/022-phase-2`.
- Số task: số dòng `- [x] T` và `- [ ] T` trong `specs/022-repo-split/tasks.md`, ở branch `feat/022-phase-2`.
- Script đo nằm trong scratchpad của session (`usage/agg.py`), không commit.
