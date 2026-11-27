  // =====================================================================
  // 19a-training-sample.js — CÁC BÀI TẬP HUẤN MẪU (tab "📚 Bài tập huấn mẫu" của module Tập huấn bằng AI).
  //
  // Viết sẵn trong mã, KHÔNG lưu Firebase: ai cũng xem được, không ai sửa/xoá được. Link học viên cố định
  // /taphuan/{mã bài mẫu}; học viên học qua link này KHÔNG được lưu kết quả lên máy chủ.
  // Phần tài liệu là NGUYÊN VĂN trích từ văn bản pháp luật (chép bằng máy từ toàn văn), kèm một ghi chú giải
  // thích do phần mềm soạn. Muốn đổi bài mẫu thì sửa trực tiếp đối tượng bên dưới.
  //
  // Phần này nằm GIỮA bản nối (không phải phần cuối) nên KHÔNG chứa khối boot().
  // =====================================================================
  const TN_SAMPLE_WARN = '⚠️ Đây là bài tập huấn MẪU do phần mềm soạn sẵn để minh hoạ cách hoạt động. Thông tin có thể sai sót, chưa đầy đủ hoặc đã thay đổi — không dùng thay cho văn bản chính thức.';
  function tnSampleCourses(){
    return [
      {
        "id": "mau-quy-ho-tro-nong-dan",
        "sample": true,
        "scope": "sample",
        "title": "Vay vốn Quỹ Hỗ trợ nông dân — những điều bà con cần biết",
        "audience": "Bà con nông dân là hội viên Hội Nông dân, có nhu cầu vay vốn sản xuất",
        "issuer": "",
        "basis": "Nghị định số 37/2023/NĐ-CP ngày 24/6/2023 của Chính phủ về thành lập, tổ chức và hoạt động của Quỹ Hỗ trợ nông dân (có hiệu lực thi hành từ ngày 08/8/2023)",
        "intro": "Bài học ngắn giúp bà con biết Quỹ Hỗ trợ nông dân là gì, ai được vay, vay được bao lâu, lãi suất thế nào và khi gặp khó khăn trả nợ thì làm sao. Học trên điện thoại, khoảng 15–20 phút, lúc nào rảnh thì học.",
        "summary": "Nghị định 37/2023/NĐ-CP quy định Quỹ Hỗ trợ nông dân cho hội viên vay vốn phát triển sản xuất, kinh doanh nông nghiệp qua phương án chung của nhóm hội viên; thời hạn vay tối đa 05 năm, lãi suất do Hội đồng quản lý Quỹ quyết định, được điều chỉnh kỳ hạn hoặc gia hạn khi gặp khó khăn.",
        "groupLabel": "Nơi ở",
        "groups": [],
        "materials": [
          {
            "id": "mmau1",
            "name": "Nghị định 37/2023/NĐ-CP — trích Điều 1–4, 14–20, 52–53",
            "kind": "paste",
            "via": "local",
            "text": "Điều 1. Phạm vi điều chỉnh và đối tượng áp dụng\n1. Phạm vi điều chỉnh:\nNghị định này quy định về thành lập, tổ chức và hoạt động của Quỹ Hỗ trợ nông dân thuộc Hội Nông dân Việt Nam.\n2. Đối tượng áp dụng:\na) Quỹ Hỗ trợ nông dân Trung ương trực thuộc Trung ương Hội Nông dân Việt Nam; Quỹ Hỗ trợ nông dân cấp tỉnh trực thuộc Hội Nông dân cấp tỉnh; Quỹ Hỗ trợ nông dân cấp huyện trực thuộc Hội Nông dân cấp huyện (sau đây gọi chung là Quỹ Hỗ trợ nông dân);\nb) Khách hàng vay vốn của Quỹ Hỗ trợ nông dân theo quy định tại Nghị định này;\nc) Hội Nông dân Việt Nam;\nd) Các tổ chức, cá nhân có liên quan trong quá trình thực hiện Nghị định này.\n\nĐiều 2. Giải thích từ ngữ\nTrong Nghị định này, các từ ngữ dưới đây được hiểu như sau:\n1. Khách hàng vay vốn là hội viên Hội Nông dân Việt Nam có phương án sản xuất kinh doanh trong lĩnh vực nông nghiệp được Quỹ Hỗ trợ nông dân cho vay vốn.\n2. Người quản lý là Chủ tịch Hội đồng quản lý, thành viên Hội đồng quản lý khác, thành viên Ban Kiểm soát, Giám đốc, Phó giám đốc và Kế toán trưởng của Quỹ Hỗ trợ nông dân.\n\nĐiều 3. Địa vị pháp lý, tư cách pháp nhân và nghĩa vụ với ngân sách nhà nước của Quỹ Hỗ trợ nông dân\n1. Quỹ Hỗ trợ nông dân là Quỹ tài chính nhà nước ngoài ngân sách, trực thuộc cơ quan Hội Nông dân các cấp; hoạt động không vì mục tiêu lợi nhuận, bảo toàn và phát triển vốn; thực hiện chức năng, nhiệm vụ theo quy định tại Nghị định này.\n2. Quỹ Hỗ trợ nông dân có tư cách pháp nhân, có vốn điều lệ, có con dấu, được mở tài khoản tại Kho bạc Nhà nước, Ngân hàng Chính sách xã hội và các ngân hàng thương mại hoạt động hợp pháp tại Việt Nam theo quy định của pháp luật.\n3. Quỹ Hỗ trợ nông dân thực hiện nghĩa vụ với ngân sách nhà nước theo quy định của pháp luật về thuế và các quy định pháp luật khác có liên quan.\n\nĐiều 4. Nguyên tắc, mục tiêu, phạm vi hoạt động và chức năng, nhiệm vụ của Quỹ Hỗ trợ nông dân\n1. Nguyên tắc hoạt động của Quỹ Hỗ trợ nông dân:\na) Tự chủ về tài chính, không vì mục tiêu lợi nhuận, công khai, minh bạch, bảo toàn và phát triển vốn;\nb) Chịu trách nhiệm hữu hạn trong phạm vi nguồn vốn chủ sở hữu của Quỹ Hỗ trợ nông dân;\nc) Thực hiện đúng chức năng, nhiệm vụ được giao theo quy định của pháp luật.\n2. Mục tiêu hoạt động của Quỹ Hỗ trợ nông dân:\na) Hỗ trợ hội viên Hội Nông dân Việt Nam xây dựng, nhân rộng mô hình sản xuất, kinh doanh có hiệu quả, góp phần tăng thu nhập, nâng cao đời sống cho nông dân;\nb) Tạo nguồn lực, điều kiện, công cụ để đoàn kết, tập hợp nông dân vào tổ chức hội, góp phần xây dựng hội và phong trào nông dân.\n3. Phạm vi hoạt động của Quỹ Hỗ trợ nông dân:\na) Quỹ Hỗ trợ nông dân Trung ương thực hiện các chức năng, nhiệm vụ được giao theo quy định tại Nghị định này trên phạm vi toàn quốc;\nb) Quỹ Hỗ trợ nông dân cấp tỉnh/huyện thực hiện các chức năng, nhiệm vụ được giao theo quy định tại Nghị định này trên phạm vi địa bàn tỉnh/huyện nơi thành lập.\n4. Chức năng, nhiệm vụ của Quỹ Hỗ trợ nông dân:\na) Tiếp nhận và quản lý nguồn vốn điều lệ được cấp từ ngân sách nhà nước theo quy định tại Nghị định này và pháp luật liên quan;\nb) Vận động các nguồn ủng hộ, tài trợ, viện trợ không hoàn lại cho hoạt động của Quỹ Hỗ trợ nông dân;\nc) Cho vay vốn đối với hội viên Hội Nông dân Việt Nam để xây dựng và nhân rộng các mô hình sản xuất, kinh doanh;\nd) Nhận ủy thác cho vay của các tổ chức, cá nhân trong và ngoài nước theo quy định của pháp luật;\nđ) Ủy thác cho Quỹ Hỗ trợ nông dân cấp dưới thực hiện nhiệm vụ cho vay theo quy định tại Nghị định này và pháp luật có liên quan;\ne) Thực hiện các nhiệm vụ khác được cấp có thẩm quyền giao theo quy định của pháp luật.\n\nĐiều 14. Đối tượng và điều kiện cho vay\n1. Đối tượng vay vốn của Quỹ Hỗ trợ nông dân là hội viên Hội nông dân Việt Nam có nhu cầu vay vốn để phát triển sản xuất, kinh doanh trong lĩnh vực nông nghiệp.\n2. Điều kiện để được vay vốn của Quỹ Hỗ trợ nông dân:\na) Khách hàng vay vốn phải thuộc đối tượng vay vốn theo quy định tại khoản 1 Điều này, có năng lực hành vi dân sự đầy đủ theo quy định của pháp luật;\nb) Khách hàng vay vốn được Ủy ban nhân dân cấp xã xác nhận đang cư trú ở địa phương nơi Quỹ Hỗ trợ nông dân cho vay vốn tại thời điểm đề xuất vay vốn từ Quỹ Hỗ trợ nông dân;\nc) Mục đích sử dụng vốn vay hợp pháp;\nd) Phương án vay vốn của khách hàng phải được tập hợp thành phương án chung của nhóm hội viên Hội nông dân cùng sản xuất, kinh doanh một loại hình sản phẩm, trên cùng một địa bàn cấp xã. Phương án vay vốn của từng khách hàng và phương án chung của nhóm hội viên Hội nông dân được Quỹ Hỗ trợ nông dân đánh giá là khả thi, có khả năng trả được nợ vay;\nđ) Tại một thời điểm, một khách hàng chỉ được vay vốn tại 01 phương án chung của nhóm hội viên Hội nông dân từ Quỹ Hỗ trợ nông dân;\ne) Các thành viên trong cùng một hộ gia đình không được phát sinh dư nợ vay tại Quỹ Hỗ trợ nông dân trong cùng một thời điểm;\ng) Các điều kiện cho vay khác quy định cụ thể tại quy định nội bộ về cho vay và quản lý nợ của Quỹ Hỗ trợ nông dân do Hội đồng quản lý Quỹ Hỗ trợ nông dân các cấp ban hành theo quy định tại Nghị định này.\n\nĐiều 15. Thời hạn cho vay\n1. Thời hạn cho vay đối với phương án của từng khách hàng và phương án chung của nhóm hội viên Hội nông dân Việt Nam tại Quỹ Hỗ trợ nông dân được xác định trên cơ sở khả năng thu hồi vốn, phù hợp với chu kỳ sản xuất kinh doanh, khả năng trả nợ của khách hàng nhưng tối đa không vượt quá 05 năm (không bao gồm thời gian gia hạn nợ).\n2. Thời gian cho vay cụ thể đối với phương án của từng khách hàng và phương án chung của nhóm hội viên Hội nông dân do Quỹ Hỗ trợ nông dân xem xét, quyết định.\n3. Tổng thời gian gia hạn nợ tối đa không quá 1/2 thời gian cho vay tại Hợp đồng tín dụng ký kết lần đầu.\n\nĐiều 16. Lãi suất cho vay và đồng tiền cho vay\n1. Lãi suất cho vay:\na) Lãi suất cho vay của Quỹ Hỗ trợ nông dân được xác định trong từng thời kỳ, theo nguyên tắc đảm bảo bù đắp đủ chi phí quản lý và các chi phí khác có liên quan đến hoạt động cho vay;\nb) Căn cứ nguyên tắc xác định lãi suất cho vay quy định tại điểm a khoản này, Hội đồng quản lý quyết định mức lãi suất cho vay cụ thể của Quỹ Hỗ trợ nông dân trong từng thời kỳ;\nc) Đối với phương án vay vốn sử dụng nguồn vốn nhận ủy thác có quy định về lãi suất cho vay khác với quy định tại Nghị định này thì thực hiện theo thỏa thuận đã ký kết với bên ủy thác.\n2. Đồng tiền cho vay và thu nợ là Đồng Việt Nam (VND).\n\nĐiều 17. Bảo đảm tiền vay\n1. Quỹ Hỗ trợ nông dân và khách hàng vay vốn thỏa thuận biện pháp bảo đảm tiền vay phù hợp với quy định của pháp luật về biện pháp bảo đảm thực hiện nghĩa vụ và pháp luật khác có liên quan.\n2. Hội đồng quản lý Quỹ Hỗ trợ nông dân quy định cụ thể về các hình thức bảo đảm tiền vay và thẩm quyền quyết định bảo đảm tiền vay tại quy định nội bộ về cho vay và quản lý nợ của Quỹ Hỗ trợ nông dân.\n\nĐiều 18. Thẩm quyền quyết định cho vay\n1. Giám đốc Quỹ Hỗ trợ nông dân quyết định cho vay đối với phương án chung của nhóm hội viên Hội nông dân có mức vốn vay không quá 15% vốn chủ sở hữu của Quỹ Hỗ trợ nông dân ghi trên báo cáo tài chính năm hoặc báo cáo tài chính 06 tháng gần nhất được Hội đồng quản lý phê duyệt. Hội đồng quản lý quy định mức cho vay tối đa cụ thể phân cấp cho Giám đốc quyết định tại quy chế nội bộ về cho vay và quản lý nợ của Quỹ Hỗ trợ nông dân.\n2. Hội đồng quản lý Quỹ Hỗ trợ nông dân quyết định cho vay đối với phương án chung của nhóm hội viên Hội nông dân có mức vốn vay vượt thẩm quyền quyết định của Giám đốc theo quy định tại khoản 1 Điều này, đảm bảo đáp ứng quy định về giới hạn cho vay quy định tại Điều 19 Nghị định này.\n\nĐiều 19. Giới hạn cho vay\n1. Dư nợ cho vay đối với một khách hàng không được vượt quá 10% vốn chủ sở hữu của Quỹ Hỗ trợ nông dân ghi trên báo cáo tài chính năm hoặc báo cáo tài chính 06 tháng gần nhất được Hội đồng quản lý phê duyệt.\n2. Dư nợ cho vay đối với một phương án chung của nhóm hội viên Hội nông dân không vượt quá 20% vốn chủ sở hữu của Quỹ Hỗ trợ nông dân ghi trên báo cáo tài chính năm hoặc báo cáo tài chính 06 tháng gần nhất được Hội đồng quản lý phê duyệt.\n3. Hội đồng quản lý Quỹ Hỗ trợ nông dân trình Ban Thường vụ Hội nông dân cùng cấp quyết định giới hạn cho vay đối với từng khách hàng và phương án chung của nhóm hội viên Hội nông dân vượt giới hạn cho vay quy định tại khoản 1, khoản 2 Điều này.\n4. Đối với phương án vay vốn sử dụng nguồn vốn nhận ủy thác có quy định về giới hạn cho vay khác với quy định của Nghị định này thì thực hiện theo thỏa thuận đã ký kết với bên ủy thác.\n\nĐiều 20. Cơ cấu lại thời hạn trả nợ\nQuỹ Hỗ trợ nông dân xem xét, quyết định cơ cấu lại thời hạn trả nợ (bao gồm biện pháp điều chỉnh kỳ hạn nợ và gia hạn nợ) trên cơ sở đề nghị của khách hàng vay vốn, khả năng tài chính của Quỹ Hỗ trợ nông dân và kết quả đánh giá của Quỹ Hỗ trợ nông dân về khả năng trả nợ của khách hàng vay vốn, cụ thể:\n1. Khách hàng không có khả năng trả nợ đúng kỳ hạn nợ gốc và/hoặc lãi tiền vay và được Quỹ Hỗ trợ nông dân đánh giá là có khả năng trả đầy đủ nợ gốc và/hoặc lãi tiền vay theo kỳ hạn trả nợ được điều chỉnh, thì Quỹ Hỗ trợ nông dân xem xét, điều chỉnh kỳ hạn trả nợ gốc và/hoặc lãi tiền vay đó phù hợp với khả năng trả nợ của khách hàng; thời hạn cho vay không thay đổi.\n2. Khách hàng không có khả năng trả nợ đúng kỳ hạn nợ gốc và/hoặc lãi tiền vay đúng thời hạn cho vay đã thỏa thuận và được Quỹ Hỗ trợ nông dân đánh giá là có khả năng trả đầy đủ nợ gốc và/hoặc lãi tiền vay trong một khoảng thời gian nhất định sau thời hạn cho vay, thì Quỹ Hỗ trợ nông dân xem xét cho gia hạn nợ vay với thời gian phù hợp với khả năng trả nợ của khách hàng, tối đa không quá 1/2 thời gian vay vốn tại hợp đồng tín dụng lần đầu đã ký.\n3. Nội dung và thẩm quyền quyết định cơ cấu lại thời hạn trả nợ theo Điều lệ tổ chức và hoạt động của Quỹ Hỗ trợ nông dân và quy chế nội bộ về cho vay và quản lý nợ của Quỹ Hỗ trợ nông dân.\n\nĐiều 52. Hiệu lực thi hành\nNghị định này có hiệu lực thi hành từ ngày 08 tháng 8 năm 2023.\n\nĐiều 53. Điều khoản chuyển tiếp\n1. Đối với việc thực hiện các hợp đồng tín dụng đã ký giữa Quỹ Hỗ trợ nông dân và các bên liên quan trước khi Nghị định này có hiệu lực thi hành: Tiếp tục thực hiện theo đúng các thỏa thuận đã ký tại hợp đồng tín dụng; trường hợp sửa đổi, bổ sung hợp đồng tín dụng đã ký sau ngày Nghị định này có hiệu lực thi hành thì thực hiện theo các quy định tại Nghị định này.\n2. Lãi suất cho vay của Quỹ Hỗ trợ nông dân được tiếp tục thực hiện theo mức lãi suất hiện hành cho đến khi mức lãi suất cho vay của Quỹ Hỗ trợ nông dân được các cấp có thẩm quyền ban hành theo quy định tại Nghị định này.",
            "addedAt": "2026-11-27T00:00:00.000Z"
          },
          {
            "id": "mmau2",
            "name": "Ghi chú giải thích của bài mẫu",
            "kind": "paste",
            "via": "local",
            "text": "GHI CHÚ CỦA BÀI MẪU (do phần mềm soạn để giải thích, không phải văn bản pháp luật)\n\n1. Những việc Nghị định 37/2023/NĐ-CP KHÔNG ghi con số cụ thể, mà giao cho từng Quỹ Hỗ trợ nông dân tự quy định:\n- Mức lãi suất cho vay cụ thể: do Hội đồng quản lý Quỹ quyết định theo từng thời kỳ (Điều 16).\n- Hình thức bảo đảm tiền vay (có cần tài sản bảo đảm hay không): do Hội đồng quản lý Quỹ quy định trong quy định nội bộ về cho vay và quản lý nợ (Điều 17).\n- Hồ sơ, trình tự, thủ tục vay vốn: theo Quy chế nội bộ mẫu do Ban Thường vụ Trung ương Hội Nông dân Việt Nam ban hành và quy chế của Quỹ nơi cho vay (Điều 23).\n- Thời hạn vay cụ thể của từng phương án: do Quỹ xem xét, quyết định, nhưng không quá 05 năm (Điều 15).\nVì vậy, khi bà con hỏi \"lãi bao nhiêu phần trăm\", \"cần giấy tờ gì\", \"có phải thế chấp không\" thì cần hỏi cán bộ Hội Nông dân nơi mình cư trú để biết mức đang áp dụng.\n\n2. Giới hạn cho vay tại Điều 19 (10% vốn chủ sở hữu của Quỹ cho một khách hàng, 20% cho một phương án chung của nhóm) là giới hạn để Quỹ quản lý an toàn vốn, không phải số tiền cụ thể mỗi hộ được vay.\n\n3. Hợp đồng vay đã ký trước ngày 08/8/2023 vẫn tiếp tục thực hiện theo đúng hợp đồng đã ký (Điều 53).",
            "addedAt": "2026-11-27T00:00:00.000Z"
          }
        ],
        "lessons": [
          {
            "id": "lmau1",
            "title": "Quỹ Hỗ trợ nông dân là gì?",
            "goal": "Hiểu Quỹ là của ai, hoạt động theo nguyên tắc nào và cho vay để làm gì.",
            "points": [
              "Quỹ là quỹ tài chính nhà nước ngoài ngân sách, trực thuộc cơ quan Hội Nông dân các cấp, hoạt động không vì mục tiêu lợi nhuận, bảo toàn và phát triển vốn (Điều 3)",
              "Quỹ cho vay vốn đối với hội viên Hội Nông dân Việt Nam để xây dựng và nhân rộng các mô hình sản xuất, kinh doanh (Điều 4)",
              "Mục tiêu: góp phần tăng thu nhập, nâng cao đời sống nông dân; đoàn kết, tập hợp nông dân vào tổ chức hội (Điều 4)",
              "Đây là vốn vay phải trả cả gốc và lãi, không phải tiền cho không"
            ]
          },
          {
            "id": "lmau2",
            "title": "Ai được vay và cần điều kiện gì?",
            "goal": "Tự kiểm tra được mình có đủ điều kiện vay vốn Quỹ hay chưa.",
            "points": [
              "Người vay là hội viên Hội Nông dân Việt Nam, có nhu cầu vay vốn để phát triển sản xuất, kinh doanh trong lĩnh vực nông nghiệp (Điều 14 khoản 1)",
              "Có năng lực hành vi dân sự đầy đủ; được Ủy ban nhân dân cấp xã xác nhận đang cư trú ở địa phương nơi Quỹ cho vay (Điều 14 khoản 2 điểm a, b)",
              "Mục đích sử dụng vốn vay phải hợp pháp (Điều 14 khoản 2 điểm c)",
              "Phương án vay của từng người được tập hợp thành phương án chung của nhóm hội viên cùng sản xuất, kinh doanh một loại sản phẩm, trên cùng một địa bàn cấp xã, và được Quỹ đánh giá là khả thi, trả được nợ (Điều 14 khoản 2 điểm d)",
              "Tại một thời điểm, mỗi người chỉ vay ở 01 phương án chung; các thành viên trong cùng một hộ gia đình không được cùng lúc có dư nợ tại Quỹ (Điều 14 khoản 2 điểm đ, e)"
            ]
          },
          {
            "id": "lmau3",
            "title": "Vay được bao lâu, lãi suất và bảo đảm tiền vay",
            "goal": "Biết thời hạn vay tối đa, ai quyết định lãi suất và việc bảo đảm tiền vay.",
            "points": [
              "Thời hạn vay tính theo chu kỳ sản xuất, khả năng trả nợ, tối đa không quá 05 năm, không tính thời gian gia hạn (Điều 15 khoản 1)",
              "Lãi suất do Hội đồng quản lý Quỹ quyết định theo từng thời kỳ, đủ bù đắp chi phí quản lý; mức cụ thể hỏi Hội Nông dân nơi cư trú (Điều 16)",
              "Tiền cho vay và thu nợ bằng Đồng Việt Nam (Điều 16 khoản 2)",
              "Biện pháp bảo đảm tiền vay do Quỹ và người vay thỏa thuận theo quy định nội bộ của Quỹ (Điều 17)",
              "Dư nợ của một người không quá 10%, của một phương án chung không quá 20% vốn chủ sở hữu của Quỹ (Điều 19)"
            ]
          },
          {
            "id": "lmau4",
            "title": "Khi gặp khó khăn trả nợ thì làm sao?",
            "goal": "Biết cách đề nghị điều chỉnh kỳ hạn hoặc gia hạn nợ đúng quy định.",
            "points": [
              "Chưa trả đúng kỳ hạn nhưng có khả năng trả theo kỳ hạn mới: đề nghị Quỹ điều chỉnh kỳ hạn trả nợ, thời hạn vay không thay đổi (Điều 20 khoản 1)",
              "Không trả hết đúng thời hạn vay nhưng có khả năng trả sau một thời gian: đề nghị gia hạn nợ, tổng thời gian gia hạn tối đa không quá 1/2 thời gian vay trong hợp đồng ký lần đầu (Điều 15 khoản 3, Điều 20 khoản 2)",
              "Quỹ quyết định dựa trên đề nghị của người vay và đánh giá khả năng trả nợ — nên báo sớm với tổ, nhóm và cán bộ Hội, không tự ý ngừng trả (Điều 20)",
              "Hợp đồng đã ký trước ngày 08/8/2023 tiếp tục thực hiện theo hợp đồng đã ký (Điều 53 khoản 1)"
            ]
          }
        ],
        "quiz": [
          {
            "id": "qmau1",
            "q": "Quỹ Hỗ trợ nông dân hoạt động theo nguyên tắc nào?",
            "options": [
              "Kinh doanh để lấy lãi càng nhiều càng tốt",
              "Không vì mục tiêu lợi nhuận, bảo toàn và phát triển vốn",
              "Cho tiền không, không phải trả lại",
              "Do người vay tự đặt ra"
            ],
            "answer": 1,
            "explain": "Điều 3 và Điều 4: Quỹ hoạt động không vì mục tiêu lợi nhuận, bảo toàn và phát triển vốn.",
            "lessonId": "lmau1"
          },
          {
            "id": "qmau2",
            "q": "Quỹ Hỗ trợ nông dân cho hội viên vay vốn để làm gì?",
            "options": [
              "Xây dựng và nhân rộng các mô hình sản xuất, kinh doanh",
              "Mua sắm đồ dùng trong nhà",
              "Trả nợ cho nơi khác",
              "Gửi tiết kiệm lấy lãi"
            ],
            "answer": 0,
            "explain": "Điều 4 khoản 4 điểm c: cho vay hội viên để xây dựng và nhân rộng các mô hình sản xuất, kinh doanh.",
            "lessonId": "lmau1"
          },
          {
            "id": "qmau3",
            "q": "Ai thuộc đối tượng được vay vốn Quỹ Hỗ trợ nông dân?",
            "options": [
              "Mọi người dân trong xã",
              "Chỉ hộ nghèo",
              "Hội viên Hội Nông dân Việt Nam có nhu cầu vay để phát triển sản xuất, kinh doanh nông nghiệp",
              "Doanh nghiệp trong khu công nghiệp"
            ],
            "answer": 2,
            "explain": "Điều 14 khoản 1.",
            "lessonId": "lmau2"
          },
          {
            "id": "qmau4",
            "q": "Cơ quan nào xác nhận người vay đang cư trú ở địa phương?",
            "options": [
              "Ủy ban nhân dân cấp xã",
              "Ngân hàng thương mại",
              "Trưởng nhóm hội viên",
              "Công an tỉnh"
            ],
            "answer": 0,
            "explain": "Điều 14 khoản 2 điểm b: Ủy ban nhân dân cấp xã xác nhận đang cư trú ở địa phương nơi Quỹ cho vay.",
            "lessonId": "lmau2"
          },
          {
            "id": "qmau5",
            "q": "Phương án vay vốn của từng người được tập hợp như thế nào?",
            "options": [
              "Mỗi người nộp riêng, không cần nhóm",
              "Thành phương án chung của nhóm hội viên cùng sản xuất, kinh doanh một loại sản phẩm, trên cùng một địa bàn cấp xã",
              "Gộp theo dòng họ",
              "Gộp tất cả hội viên trong tỉnh"
            ],
            "answer": 1,
            "explain": "Điều 14 khoản 2 điểm d.",
            "lessonId": "lmau2"
          },
          {
            "id": "qmau6",
            "q": "Vợ đang còn nợ vay Quỹ. Chồng cùng hộ gia đình có được vay Quỹ cùng lúc không?",
            "options": [
              "Được, nếu vay ở phương án khác",
              "Không, các thành viên cùng một hộ không được cùng lúc có dư nợ tại Quỹ",
              "Được, nếu có tài sản bảo đảm",
              "Được, nếu vay ít tiền"
            ],
            "answer": 1,
            "explain": "Điều 14 khoản 2 điểm e.",
            "lessonId": "lmau2"
          },
          {
            "id": "qmau7",
            "q": "Tại một thời điểm, một người được vay ở mấy phương án chung của nhóm hội viên?",
            "options": [
              "01 phương án",
              "02 phương án",
              "03 phương án",
              "Không giới hạn"
            ],
            "answer": 0,
            "explain": "Điều 14 khoản 2 điểm đ.",
            "lessonId": "lmau2"
          },
          {
            "id": "qmau8",
            "q": "Thời hạn vay tối đa của Quỹ Hỗ trợ nông dân (không tính thời gian gia hạn) là bao lâu?",
            "options": [
              "12 tháng",
              "03 năm",
              "05 năm",
              "10 năm"
            ],
            "answer": 2,
            "explain": "Điều 15 khoản 1: tối đa không vượt quá 05 năm, không bao gồm thời gian gia hạn nợ.",
            "lessonId": "lmau3"
          },
          {
            "id": "qmau9",
            "q": "Mức lãi suất cho vay cụ thể của Quỹ do ai quyết định?",
            "options": [
              "Người vay tự thỏa thuận với nhau",
              "Hội đồng quản lý Quỹ quyết định theo từng thời kỳ",
              "Luôn cố định 0%",
              "Trưởng thôn, ấp"
            ],
            "answer": 1,
            "explain": "Điều 16 khoản 1 điểm b.",
            "lessonId": "lmau3"
          },
          {
            "id": "qmau10",
            "q": "Tiền cho vay và thu nợ của Quỹ bằng loại tiền nào?",
            "options": [
              "Đô la Mỹ",
              "Vàng",
              "Đồng Việt Nam",
              "Lúa, gạo"
            ],
            "answer": 2,
            "explain": "Điều 16 khoản 2.",
            "lessonId": "lmau3"
          },
          {
            "id": "qmau11",
            "q": "Hợp đồng vay ký lần đầu 2 năm. Tổng thời gian gia hạn nợ tối đa là bao lâu?",
            "options": [
              "06 tháng",
              "01 năm",
              "02 năm",
              "Không được gia hạn"
            ],
            "answer": 1,
            "explain": "Điều 15 khoản 3 và Điều 20 khoản 2: tối đa không quá 1/2 thời gian cho vay tại hợp đồng ký lần đầu (1/2 của 2 năm là 1 năm).",
            "lessonId": "lmau4"
          },
          {
            "id": "qmau12",
            "q": "Chưa trả được đúng kỳ hạn nhưng có khả năng trả theo kỳ hạn mới thì nên làm gì?",
            "options": [
              "Tự ý ngừng trả, chờ Quỹ nhắc",
              "Đề nghị Quỹ xem xét điều chỉnh kỳ hạn trả nợ; thời hạn vay không thay đổi",
              "Vay nơi khác trả cho Quỹ",
              "Không cần báo ai"
            ],
            "answer": 1,
            "explain": "Điều 20 khoản 1: Quỹ xem xét điều chỉnh kỳ hạn trả nợ trên cơ sở đề nghị của khách hàng.",
            "lessonId": "lmau4"
          }
        ],
        "settings": {
          "quizCount": 5,
          "passPercent": 70
        },
        "status": "open",
        "closeAt": "",
        "createdAt": "2026-11-27T00:00:00.000Z",
        "updatedAt": "2026-11-27T00:00:00.000Z",
        "deleted": false
      },
      {
        "id": "mau-can-bo-hoi-giup-hoi-vien",
        "sample": true,
        "scope": "sample",
        "title": "Cán bộ Hội cấp cơ sở giúp hội viên phát triển kinh tế — từ trăn trở đến việc làm cụ thể",
        "audience": "Cán bộ Hội Nông dân cấp cơ sở (xã, phường) và chi hội trưởng",
        "issuer": "",
        "defaultCall": "Đồng chí",
        "groupLabel": "Đơn vị công tác",
        "groups": [],
        "basis": "Tài liệu tham khảo: Hỏi đáp “Cách người cán bộ Hội Nông dân giúp đỡ hội viên sao cho hiệu quả” — tác giả Phạm Văn Thành (tài liệu tham khảo, không phải văn bản quy phạm pháp luật)",
        "intro": "Bài tập huấn ngắn dành cho cán bộ Hội cơ sở: vì sao nông dân khó giàu và phong trào khó bền, hướng giải căn cơ, và năm việc cụ thể Hội cấp cơ sở làm được ngay. Cuối bài, trợ giảng cùng đồng chí chọn việc phù hợp với địa bàn mình. Khoảng 20 phút.",
        "summary": "Tài liệu chỉ ra các nút thắt khiến nông dân khó giàu (sản xuất manh mún, trồng theo phong trào, liên kết lỏng lẻo, hỗ trợ phần ngọn), hướng giải căn cơ (tư duy kinh tế, hợp tác xã kiểu mới, chế biến) và năm việc cụ thể Hội cấp cơ sở làm được ngay.",
        "materials": [
          {
            "id": "mmb1",
            "name": "Hỏi đáp: Cách người cán bộ Hội Nông dân giúp đỡ hội viên sao cho hiệu quả (Phạm Văn Thành, đã biên tập nhẹ)",
            "kind": "paste",
            "via": "local",
            "text": "CÁCH NGƯỜI CÁN BỘ HỘI NÔNG DÂN GIÚP ĐỠ HỘI VIÊN SAO CHO HIỆU QUẢ (HỎI ĐÁP)\nTác giả: Phạm Văn Thành. Bản dùng trong bài tập huấn mẫu đã được biên tập nhẹ về câu chữ và cập nhật tên gọi cấp hành chính; giữ nguyên ý của tài liệu gốc.\n\nHỎI (lần 1): Tôi công tác ở Hội Nông dân đã 2 năm, phối hợp triển khai nhiều dự án, đề tài, phong trào nông dân, nhưng thấy chúng không bền vững, một thời gian lại tắt dần. Vì sao người nông dân cứ lặp lại cảnh \"được mùa mất giá, được giá mất mùa\"? Làm sao để nông dân giàu lên như người làm công ăn lương hay doanh nghiệp? Có phải đợi đến khi khoa học công nghệ, trí tuệ nhân tạo thật phát triển thì nông dân mới thoát nghèo? Hay do thị trường — sản xuất dồi dào thì lại mất giá?\n\nĐÁP:\nTrăn trở này là nỗi niềm chung của nhiều người tâm huyết với nông nghiệp, nông dân, nông thôn. Vòng luẩn quẩn \"được mùa mất giá, được giá mất mùa\" hay các phong trào \"sớm nở tối tàn\" không phải ngẫu nhiên, và lời giải không phải là ngồi chờ trí tuệ nhân tạo hay công nghệ tương lai. Gốc rễ nằm ở những nút thắt sau:\n\n1. Nút thắt cốt lõi: vì sao nông dân mãi quanh quẩn?\n\na) Quy mô sản xuất nhỏ lẻ, manh mún\n- Nông nghiệp nước ta về bản chất vẫn là kinh tế hộ gia đình; đất đai bị chia nhỏ, mỗi hộ chỉ vài sào, vài công.\n- Sản xuất nhỏ lẻ thì chi phí đầu vào (phân bón, thuốc bảo vệ thực vật, giống) tính trên một đơn vị sản phẩm rất cao.\n- Nông dân khó tự đầu tư máy móc hiện đại vì không bõ công và không đủ vốn.\n- Vì nhỏ lẻ nên không cung ứng được lượng hàng lớn, đồng đều chất lượng cho đơn vị thu mua lớn hoặc xuất khẩu chính ngạch.\n\nb) Điệp khúc \"được mùa mất giá\" — cái bẫy của thị trường tự phát\nĐây là quy luật cung — cầu, nhưng bị khuếch đại bởi tâm lý đám đông:\n- Thiếu thông tin thị trường: trồng cây gì, nuôi con gì chủ yếu nhìn sang nhà hàng xóm. Thấy năm nay sầu riêng được giá, năm sau cả vùng chặt cà phê trồng sầu riêng; kết quả là cung vượt cầu, giá xuống đáy.\n- Tư duy thương mại ngắn hạn: quan hệ giữa nông dân và thương lái (kênh tiêu thụ chính) rất lỏng lẻo. Được giá thì có người phá vỡ cam kết với doanh nghiệp để bán ra ngoài; mất giá thì thương lái bỏ mặc nông dân. Không có hợp đồng hay cam kết bền vững nào bảo vệ hai bên.\n\nc) Vì sao các phong trào, dự án không bền vững\n- Hỗ trợ phần ngọn, thiếu phần gốc: nhiều dự án chỉ hỗ trợ kỹ thuật nuôi trồng (phần ngọn) mà chưa giải quyết được đầu ra (phần gốc). Hết kinh phí hỗ trợ, nông dân lại tự xoay xở với thị trường, gặp khó lại quay về lối cũ.\n- Tâm lý ỷ lại: một bộ phận tham gia mô hình chủ yếu để nhận hỗ trợ (vốn, giống, phân bón), chưa thật sự chuyển từ \"sản xuất nông nghiệp\" sang \"kinh doanh nông nghiệp\".\n\n2. Giải pháp căn cơ: nông dân có cần đợi AI hay công nghệ cao?\nCông nghệ, AI, tự động hoá là công cụ rất tốt, nhưng nếu chưa giải quyết được tư duy và cách tổ chức sản xuất thì công nghệ cao cũng bất lực. Một robot hái cam hay cảm biến đo độ ẩm đất không giúp bán được cam nếu cả vùng đều thừa cam.\nĐể nông dân giàu lên, giải pháp căn cơ phải đi từ 3 sự chuyển đổi:\n\na) Chuyển từ \"tư duy sản xuất\" sang \"tư duy kinh tế\"\n- Không chỉ cắm cúi làm ra sản phẩm rồi trông chờ thương lái đến mua; phải biết thị trường cần gì, cần bao nhiêu, tiêu chuẩn chất lượng ra sao (VietGAP, GlobalGAP, hữu cơ) để sản xuất đúng thứ thị trường cần.\n- Người nông dân tự xem mình là một \"chủ doanh nghiệp nhỏ\": biết tính chi phí, khấu hao, quản trị rủi ro.\n\nb) \"Muốn đi xa phải đi cùng nhau\" — hợp tác xã kiểu mới\n- Đây là chìa khoá để giải bài toán manh mún: liên kết đất, liên kết người vào các hợp tác xã kiểu mới hoạt động thực chất.\n- Hợp tác xã đại diện cho hàng trăm nông dân để mua vật tư đầu vào giá sỉ (giảm chi phí) và ký hợp đồng tiêu thụ dài hạn với siêu thị, doanh nghiệp xuất khẩu (ổn định đầu ra).\n- Có hợp tác xã thì việc đưa máy móc, công nghệ, AI vào đồng ruộng mới khả thi và có lời.\n\nc) Chế biến sâu và xây dựng thương hiệu\n- Nông sản phần lớn còn bán thô (quả tươi, hạt thô), tỷ lệ chế biến sâu thấp. Bán xoài tươi thì nhanh hỏng, dễ bị ép giá; làm nước ép, xoài sấy dẻo thì để được lâu và giá trị tăng nhiều lần.\n- Chế biến là \"van điều tiết\" của thị trường: khi được mùa, nông sản vào nhà máy chế biến thay vì phải bán tháo, giữ cho giá không sụt quá sâu.\n\nĐôi điều chia sẻ với cán bộ Hội: thay vì chỉ mang đến những hỗ trợ ngắn hạn (con giống, phân bón), Hội nên hướng mạnh hơn tới:\n- Thay đổi nhận thức và tư duy: tổ chức tập huấn không chỉ về kỹ thuật mà về kỹ năng thị trường, quản lý tài chính và liên kết kinh tế.\n- Làm cầu nối thực chất: giúp nông dân kết nối doanh nghiệp bao tiêu uy tín; xây dựng hợp tác xã có ban quản trị nhạy bén kinh doanh, không chỉ làm hành chính.\n- Số hoá thông tin: chỉ cần giúp nông dân tiếp cận tốt thông tin dự báo thị trường, cảnh báo dịch bệnh qua các ứng dụng điện thoại cơ bản cũng là bước tiến lớn.\nNông dân Việt Nam cần cù, thông minh, chịu khó. Cái còn thiếu không phải giọt mồ hôi, mà là cách tổ chức sản xuất bài bản và tư duy thị trường sắc bén.\n\nHỎI (lần 2): Những giải pháp trên rất hay nhưng còn tầm vĩ mô. Tôi là cán bộ Hội Nông dân cấp xã, thường xuyên xuống địa bàn, làm việc cùng nông dân. Cụ thể bản thân tôi và Hội Nông dân xã phải làm những việc gì, giải pháp nào thực tế nhất ở cơ sở?\n\nĐÁP:\nGóp ý rất thẳng thắn và đúng. Các chiến lược như \"tư duy kinh tế\", \"chế biến sâu\", \"hợp tác xã kiểu mới\" là tầm vĩ mô; đặt lên vai cán bộ Hội cấp xã việc xây nhà máy chế biến hay thay đổi cả nền kinh tế là quá sức.\nCấp xã là cấp trực tiếp, sát dân nhất, nhưng nguồn lực, kinh phí và thẩm quyền có hạn. Vì vậy giải pháp ở cấp xã phải là những việc \"không tốn nhiều tiền nhưng tốn công sức, làm được ngay và thấy ngay kết quả\". Năm việc cụ thể:\n\n1. Thay vì tuyên truyền suông, hãy làm \"bác sĩ cây trồng, vật nuôi\" từ xa\n- Nông dân sợ nhất là mua nhầm thuốc giả, phân bón giả, và gặp dịch bệnh mà không biết hỏi ai (hỏi đại lý thì đại lý thường chỉ lo bán hàng).\n- Việc cụ thể: lập các nhóm Zalo theo từng chuyên canh (ví dụ \"Nhóm trồng sầu riêng thôn A\", \"Nhóm nuôi heo thôn B\").\n- Cách làm: cán bộ Hội không cần là chuyên gia. Mời 1–2 kỹ sư nông nghiệp có uy tín (của cơ quan khuyến nông, trạm trồng trọt — bảo vệ thực vật, thú y, hoặc kỹ sư có tâm của doanh nghiệp, với điều kiện chỉ tư vấn kỹ thuật, không quảng cáo bán hàng) vào nhóm. Ruộng vườn có dấu hiệu bệnh, bà con chụp ảnh, quay video gửi lên; kỹ sư \"bắt bệnh\" và hướng dẫn xử lý ngay.\n- Kết quả: bà con thấy Hội có ích thật sự, giải quyết được cái khó hằng ngày; cán bộ không phải đi từng nhà mời họp, dân tự tin Hội.\n\n2. Chữa bệnh \"trồng theo phong trào\" bằng bảng thông tin nông nghiệp\n- Nông dân trồng gì thường theo cảm tính: thấy nhà bên cạnh bán được giá thì làm theo. Hội xã cần là \"bộ não thông tin\" của xã.\n- Việc cụ thể: đặt một bảng thông tin nông nghiệp lớn ở nơi tiếp dân của Ủy ban nhân dân xã hoặc hội trường thôn, ấp (có thể làm thêm bản trên nhóm Zalo).\n- Cách làm: cập nhật hằng tuần (hoặc hằng ngày) hai thông tin: giá cả thị trường (giá chợ đầu mối, giá thu mua của thương lái lớn tại địa phương để dân không bị ép giá); bản đồ diện tích (ví dụ: \"Thôn A đã trồng 20 ha kiệu — đã đủ sản lượng tiêu thụ, hộ tiếp theo nên cân nhắc cây ngắn ngày khác\").\n- Kết quả: giúp bà con bớt \"nóng\" khi thấy một cây đang lên giá, giảm rủi ro cung vượt cầu ngay tại địa bàn.\n\n3. Rà lại các mô hình cũ: đừng gom ép, hãy đi tìm \"hạt nhân\"\n- Sai lầm hay gặp: gom đại vài chục hộ lại, tuyên bố thành lập tổ hợp tác cho có thành tích, rồi tổ tan rã.\n- Việc cụ thể: tìm \"nông dân sản xuất giỏi\" hoặc \"người thu mua có tâm\" ngay tại địa phương.\n- Cách làm: xã nào cũng có 1–2 nông dân giỏi, nhạy bén, hoặc một người thu mua trẻ muốn làm ăn bài bản. Đến gặp riêng, đặt vấn đề: \"Anh làm giỏi, anh làm trưởng nhóm; Hội hỗ trợ thủ tục, hướng dẫn vay vốn ưu đãi cho anh và 5 hộ xung quanh làm theo quy trình của anh.\"\n- Kết quả: nông dân \"trăm nghe không bằng một thấy\" — họ không nghe cán bộ nói, nhưng thấy hàng xóm làm giàu thì tự làm theo. Hội chỉ cần đỡ đầu cho \"đầu tàu\", để đầu tàu kéo cả đoàn tàu.\n\n4. Bảo vệ bà con trước \"tín dụng đen\" và vòng mua chịu vật tư giá cao\n- Nhiều hộ nghèo vì mắc bẫy: đầu vụ vay tiền hoặc mua chịu phân bón giá cao của đại lý; cuối vụ phải bán nông sản rẻ cho chính đại lý đó để trừ nợ.\n- Việc cụ thể: quản lý tốt và khai thác hiệu quả các tổ tiết kiệm và vay vốn của Ngân hàng Chính sách xã hội, nguồn vốn Quỹ Hỗ trợ nông dân và các chương trình phối hợp với Ngân hàng Nông nghiệp và Phát triển nông thôn (Agribank).\n- Cách làm: rà soát từng hộ, hướng dẫn làm thủ tục vay vốn ưu đãi nhanh, minh bạch, để bà con không phải \"vay nóng\" hay ký sổ nợ đại lý. Đồng thời phối hợp, ký thỏa thuận với các công ty vật tư nông nghiệp uy tín để cung ứng phân bón, vật tư tận gốc cho bà con theo hình thức trả chậm, đúng quy định và có giám sát; Hội không đứng ra bảo lãnh nghĩa vụ trả nợ của cá nhân.\n- Kết quả: cắt vòng \"mua đắt bán rẻ\" làm bà con thiệt thòi.\n\n5. Chủ động kết nối nông sản ra khỏi lũy tre làng\n- Đừng đợi doanh nghiệp lớn tìm đến; Hội xã phải chủ động \"chào hàng\".\n- Việc cụ thể: kết nối với cửa hàng thực phẩm sạch, các nhóm chợ chung cư ở thành phố, hoặc Hội Nông dân các phường, xã ở đô thị lân cận.\n- Cách làm: xã có đặc sản gì (gạo ngon, rau sạch, trái cây đặc trưng) thì chụp ảnh, làm hồ sơ nhỏ chứng minh nguồn gốc rõ ràng; dùng quan hệ trong hệ thống Hội để kết nối vào các phiên chợ nông sản, điểm bán của các tổ chức đoàn thể.\n- Kết quả: tạo kênh tiêu thụ riêng, tuy nhỏ nhưng giúp nông dân có đầu ra trực tiếp, ít qua trung gian, nâng giá trị sản phẩm.\n\nTóm lại, một ngày làm việc thực chất của cán bộ Hội xã không phải chỉ ngồi viết báo cáo phong trào, mà là: sáng xuống vườn xem nhà ông A xử lý bệnh trên cây có cam thế nào; trưa lên nhóm Zalo nhắc bà con giá heo đang giảm, chưa nên xuất chuồng vội; chiều cùng cán bộ Ngân hàng Chính sách xã hội xét hồ sơ vay vốn cho mấy hộ nghèo; tối ngồi với chủ nhiệm hợp tác xã bàn tháng sau bán rau cho ai.\nLàm được những việc \"tuy nhỏ nhưng thật\" như vậy, cán bộ Hội mới thật sự là chỗ dựa của nông dân ở cơ sở.",
            "addedAt": "2026-11-27T00:00:00.000Z"
          }
        ],
        "lessons": [
          {
            "id": "lmb1",
            "title": "Vì sao nông dân khó giàu và phong trào khó bền?",
            "goal": "Chỉ ra được các nút thắt gốc rễ thay vì đổ lỗi cho thị trường hay chờ công nghệ.",
            "points": [
              "Sản xuất nhỏ lẻ, manh mún: chi phí đầu vào cao, khó đầu tư máy móc, không đủ hàng lớn và đồng đều cho người mua lớn",
              "\"Được mùa mất giá\" do thiếu thông tin thị trường và tâm lý đám đông — thấy hàng xóm được giá là làm theo, cung vượt cầu",
              "Liên kết với thương lái, doanh nghiệp lỏng lẻo, thiếu cam kết ràng buộc hai bên",
              "Dự án không bền vì chỉ hỗ trợ phần ngọn (kỹ thuật), thiếu phần gốc (đầu ra), cộng thêm tâm lý ỷ lại vào hỗ trợ"
            ]
          },
          {
            "id": "lmb2",
            "title": "Hướng giải căn cơ: tư duy, hợp tác, chế biến",
            "goal": "Hiểu công nghệ chỉ là công cụ; cái cần trước là tư duy kinh tế và cách tổ chức sản xuất.",
            "points": [
              "Công nghệ, AI không giúp bán được hàng nếu cả vùng thừa sản phẩm — phải giải quyết tư duy và tổ chức sản xuất trước",
              "Chuyển từ tư duy sản xuất sang tư duy kinh tế: sản xuất theo nhu cầu, tiêu chuẩn thị trường; tự xem mình là chủ doanh nghiệp nhỏ",
              "Hợp tác xã kiểu mới thực chất: mua vật tư giá sỉ, ký hợp đồng tiêu thụ dài hạn, tạo điều kiện đưa máy móc, công nghệ vào",
              "Chế biến sâu và thương hiệu là \"van điều tiết\" giá khi được mùa",
              "Vai trò của Hội: thay đổi nhận thức, làm cầu nối thực chất, giúp nông dân tiếp cận thông tin thị trường"
            ]
          },
          {
            "id": "lmb3",
            "title": "Năm việc Hội cấp cơ sở làm được ngay",
            "goal": "Nắm được 5 việc cụ thể, ít tốn kinh phí, làm được ngay và thấy kết quả.",
            "points": [
              "Nhóm Zalo theo chuyên canh có kỹ sư uy tín tư vấn — chỉ tư vấn kỹ thuật, không quảng cáo bán hàng",
              "Bảng thông tin nông nghiệp: giá cả thị trường và bản đồ diện tích, cập nhật hằng tuần, để bà con bớt trồng theo phong trào",
              "Không gom ép lập tổ cho có thành tích; tìm \"hạt nhân\" — nông dân giỏi, người thu mua có tâm — làm đầu tàu cho vài hộ làm theo",
              "Chống tín dụng đen, vòng mua chịu vật tư giá cao: khai thác tốt tổ vay vốn Ngân hàng Chính sách xã hội, Quỹ Hỗ trợ nông dân; phối hợp cung ứng vật tư trả chậm đúng quy định, Hội không bảo lãnh nợ cá nhân",
              "Chủ động kết nối tiêu thụ qua hệ thống Hội: hồ sơ nguồn gốc rõ ràng, phiên chợ nông sản, cửa hàng thực phẩm sạch"
            ]
          },
          {
            "id": "lmb4",
            "title": "Áp dụng cho địa bàn của đồng chí",
            "goal": "Chọn được 1–2 việc phù hợp với địa bàn mình và cách bắt đầu trong tháng tới.",
            "points": [
              "Xác định chuyên canh chính và nút thắt lớn nhất của bà con trên địa bàn mình",
              "Chọn 1–2 việc trong năm việc, ưu tiên việc ít tốn kinh phí và thấy kết quả sớm",
              "Lên bước đầu cụ thể: gặp ai, làm gì, trong bao lâu, đo kết quả bằng gì",
              "Một ngày làm việc thực chất là đi cơ sở, theo sát việc của bà con, không chỉ viết báo cáo phong trào"
            ]
          }
        ],
        "quiz": [
          {
            "id": "qmb1",
            "q": "Theo tài liệu, gốc rễ của vòng \"được mùa mất giá\" là gì?",
            "options": [
              "Do thời tiết thất thường",
              "Thiếu thông tin thị trường và tâm lý đám đông khiến cung vượt cầu",
              "Do nhà nước không mua hết nông sản",
              "Do nông dân lười"
            ],
            "answer": 1,
            "explain": "Phần 1: nông dân trồng theo hàng xóm, thiếu thông tin thị trường nên cả vùng cùng làm một thứ, cung vượt cầu.",
            "lessonId": "lmb1"
          },
          {
            "id": "qmb2",
            "q": "Vì sao nhiều dự án, phong trào \"sớm nở tối tàn\"?",
            "options": [
              "Vì kinh phí quá nhiều",
              "Vì chỉ hỗ trợ phần ngọn (kỹ thuật), thiếu phần gốc (đầu ra), cộng tâm lý ỷ lại",
              "Vì nông dân không thích học kỹ thuật",
              "Vì cán bộ Hội thay đổi liên tục"
            ],
            "answer": 1,
            "explain": "Phần 1: hỗ trợ phần ngọn, thiếu phần gốc và tâm lý ỷ lại vào hỗ trợ.",
            "lessonId": "lmb1"
          },
          {
            "id": "qmb3",
            "q": "Nhận định nào đúng với tài liệu về vai trò của công nghệ, AI?",
            "options": [
              "Phải chờ AI phát triển nông dân mới giàu được",
              "Công nghệ là công cụ tốt nhưng phải giải quyết tư duy và tổ chức sản xuất trước",
              "Công nghệ không có ích gì cho nông nghiệp",
              "Chỉ cần mua máy móc là hết nghèo"
            ],
            "answer": 1,
            "explain": "Phần 2: robot hay cảm biến không giúp bán được hàng nếu cả vùng đều thừa sản phẩm.",
            "lessonId": "lmb2"
          },
          {
            "id": "qmb4",
            "q": "Hợp tác xã kiểu mới giúp nông dân điều gì?",
            "options": [
              "Được nhà nước cho tiền không hoàn lại",
              "Mua vật tư giá sỉ và ký hợp đồng tiêu thụ dài hạn, ổn định đầu ra",
              "Không phải nộp thuế",
              "Mỗi hộ tự bán riêng được giá cao hơn"
            ],
            "answer": 1,
            "explain": "Phần 2: HTX đại diện nhiều hộ để đàm phán mua đầu vào giá sỉ và ký hợp đồng tiêu thụ dài hạn.",
            "lessonId": "lmb2"
          },
          {
            "id": "qmb5",
            "q": "Cả thôn định chặt cà phê trồng sầu riêng vì năm nay sầu riêng đang được giá. Theo tài liệu, Hội xã nên làm gì trước?",
            "options": [
              "Vận động cả thôn chuyển đổi ngay",
              "Công khai giá thị trường và diện tích đã trồng trên bảng thông tin để bà con cân nhắc",
              "Không can thiệp vì là quyền của dân",
              "Xin kinh phí hỗ trợ giống sầu riêng"
            ],
            "answer": 1,
            "explain": "Việc 2: bảng thông tin giá cả và bản đồ diện tích giúp bà con bớt trồng theo phong trào.",
            "lessonId": "lmb3"
          },
          {
            "id": "qmb6",
            "q": "Khi mời kỹ sư vào nhóm Zalo chuyên canh, điều cần lưu ý là gì?",
            "options": [
              "Ưu tiên người bán thuốc nhiều nhất",
              "Kỹ sư có uy tín và chỉ tư vấn kỹ thuật, không quảng cáo bán hàng",
              "Cán bộ Hội phải tự trả lời mọi câu hỏi",
              "Chỉ mời người quen của cán bộ"
            ],
            "answer": 1,
            "explain": "Việc 1: mời kỹ sư nông nghiệp có uy tín; nếu là kỹ sư doanh nghiệp thì chỉ tư vấn kỹ thuật.",
            "lessonId": "lmb3"
          },
          {
            "id": "qmb7",
            "q": "Cách làm nào được tài liệu khuyên khi xây dựng tổ, nhóm sản xuất?",
            "options": [
              "Gom thật nhiều hộ để có thành tích",
              "Tìm nông dân giỏi hoặc người thu mua có tâm làm \"đầu tàu\" cho vài hộ làm theo",
              "Chỉ lập tổ khi có dự án cấp kinh phí",
              "Giao chỉ tiêu cho từng thôn, ấp"
            ],
            "answer": 1,
            "explain": "Việc 3: đi tìm \"hạt nhân\" — nông dân thấy hàng xóm làm giàu thì tự làm theo.",
            "lessonId": "lmb3"
          },
          {
            "id": "qmb8",
            "q": "Để giúp bà con thoát vòng mua chịu phân bón giá cao, Hội cấp cơ sở nên làm gì?",
            "options": [
              "Đứng ra bảo lãnh nợ cho từng hộ",
              "Hướng dẫn vay vốn ưu đãi minh bạch và phối hợp cung ứng vật tư trả chậm đúng quy định, có giám sát",
              "Cấm bà con mua ở đại lý",
              "Cho bà con vay tiền quỹ Hội không cần thủ tục"
            ],
            "answer": 1,
            "explain": "Việc 4: khai thác tổ vay vốn NHCSXH, Quỹ HTND; phối hợp cung ứng vật tư trả chậm — Hội không bảo lãnh nghĩa vụ trả nợ cá nhân.",
            "lessonId": "lmb3"
          },
          {
            "id": "qmb9",
            "q": "Xã có đặc sản gạo ngon nhưng bán qua nhiều tầng trung gian. Việc nào phù hợp nhất ở cấp xã?",
            "options": [
              "Đợi doanh nghiệp lớn tự tìm đến",
              "Làm hồ sơ nguồn gốc rõ ràng, kết nối phiên chợ nông sản, cửa hàng thực phẩm sạch qua hệ thống Hội",
              "Xây nhà máy chế biến gạo",
              "Chỉ bán cho một thương lái quen"
            ],
            "answer": 1,
            "explain": "Việc 5: chủ động \"chào hàng\", tạo kênh tiêu thụ trực tiếp dù nhỏ.",
            "lessonId": "lmb3"
          },
          {
            "id": "qmb10",
            "q": "Tiêu chí chọn việc để bắt đầu ở cấp cơ sở theo tài liệu là gì?",
            "options": [
              "Việc càng lớn, càng tốn kinh phí càng tốt",
              "Không tốn nhiều tiền, tốn công sức, làm được ngay và thấy ngay kết quả",
              "Việc nào cấp trên giao thì làm",
              "Việc nào dễ viết báo cáo nhất"
            ],
            "answer": 1,
            "explain": "Đáp lần 2: giải pháp ở cấp xã là việc không tốn nhiều tiền nhưng tốn công sức, làm được ngay, thấy ngay kết quả.",
            "lessonId": "lmb4"
          }
        ],
        "settings": {
          "quizCount": 5,
          "passPercent": 70
        },
        "status": "open",
        "closeAt": "",
        "createdAt": "2026-11-27T00:00:00.000Z",
        "updatedAt": "2026-11-27T00:00:00.000Z",
        "deleted": false
      },
    ];
  }
  function tnSampleById(id){ return tnSampleCourses().find(c=> c.id===id) || null; }
  function tnIsSampleId(id){ return !!tnSampleById(id); }
