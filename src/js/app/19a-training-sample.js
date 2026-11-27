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
    ];
  }
  function tnSampleById(id){ return tnSampleCourses().find(c=> c.id===id) || null; }
  function tnIsSampleId(id){ return !!tnSampleById(id); }
