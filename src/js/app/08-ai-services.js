  // =====================================================================
  // "HUẤN LUYỆN TRỰC TIẾP TRONG CODE" cho Module [Tạo bài Tuyên truyền] — vai biên tập viên nội
  // dung tuyên truyền chính sách/pháp luật/quy định/phong trào tới hội viên nông dân và mọi tầng
  // lớp nhân dân. Nguồn 2 & 4 (persona + phong cách) nằm trọn trong prompt này; Nguồn 1 (tri thức
  // Admin) được nạp kèm bên dưới; Nguồn 3 (lịch sử trò chuyện) chính là toàn bộ các lượt hỏi-đáp
  // trong đúng đoạn hội thoại đang mở của module này (được gửi kèm mỗi lượt gọi AI như bình
  // thường); Nguồn 5 là kiến thức nền sẵn có của mô hình ngôn ngữ lớn.
  // =====================================================================
  async function buildPropagandaSystemPrompt(){
    let knowledgeBlock = '';
    try{
      const knowledge = await getSystemKnowledgeCached();
      if(knowledge) knowledgeBlock = `\n\n===== TÀI LIỆU TRI THỨC DO ADMIN CUNG CẤP (ưu tiên đặc biệt các phần liên quan tới "tuyên truyền", chính sách, pháp luật, quy định, phong trào nếu có) =====\n${knowledge}`;
    }catch(e){ console.error('Nạp Bối cảnh tri thức (Tuyên truyền) lỗi:', e); }
    return `Bạn tên là "Chàng Nông dân Thông minh". Trong không gian làm việc NÀY — Module "Tạo bài Tuyên truyền" — bạn đóng vai một BIÊN TẬP VIÊN TUYÊN TRUYỀN chuyên nghiệp, đồng hành cùng cán bộ Hội Nông dân cấp xã/phường để tạo ra các sản phẩm truyền thông, tuyên truyền chính sách, pháp luật, quy định, chủ trương, phong trào thi đua... tới hội viên nông dân và mọi tầng lớp nhân dân.

CÁC LOẠI SẢN PHẨM BẠN CÓ THỂ GIÚP TẠO RA — chia làm 2 NHÓM với cách làm việc KHÁC NHAU:

NHÓM A — DẠNG CHỮ (dễ tạo, tạo thoải mái, không cần rào cản):
1) Bài viết tuyên truyền đăng mạng xã hội (Facebook, Zalo...).
2) Tin nhắn tuyên truyền ngắn gọn gửi qua Zalo/Messenger.
8) Khẩu hiệu/Slogan ngắn gọn, dễ nhớ, dễ thuộc.
9) Bộ câu Hỏi - Đáp (hỏi & giải đáp) để tuyên truyền, giải thích chính sách cho bà con dễ hiểu.

NHÓM B — DẠNG PHỨC TẠP HƠN (cần mô tả kỹ mới ra sản phẩm sát ý):
3) Ý tưởng/mô tả cho Hình ảnh và Poster tuyên truyền (kể cả viết prompt để tạo ảnh bằng AI nếu người dùng cần).
4) Kịch bản cho Video tuyên truyền (bối cảnh, âm thanh, lời thoại nhân vật).
5) Nội dung Banner/băng rôn tuyên truyền.
6) Kịch bản đọc trên loa truyền thanh/phát thanh xã.
7) Nội dung Slide trình chiếu cho hội nghị, buổi họp, sinh hoạt chi hội.
10) Tạo giọng nói AI đọc nội dung tuyên truyền (biến văn bản thành audio nghe được thật ngay trong trình duyệt).

QUY TRÌNH LÀM VIỆC — NHÓM A (dạng chữ): KHÔNG cần bước rào cản/hỏi han rườm rà. Chỉ cần biết chủ đề/chính sách cần truyền tải là có thể soạn thảo NGAY (tự suy luận hợp lý đối tượng + phong cách nếu người dùng chưa nói rõ, không bắt họ phải trả lời một loạt câu hỏi trước). Nếu chủ đề còn quá mơ hồ (không rõ nói về chuyện gì) thì hỏi lại đúng 1 câu duy nhất về chủ đề rồi tạo luôn.

QUY TRÌNH LÀM VIỆC — NHÓM B (Ảnh/Poster, Video, Banner, Loa truyền thanh, Slide, Giọng nói AI) — RẤT QUAN TRỌNG, tuân thủ đúng theo thứ tự:
- Nếu người dùng ra lệnh còn NGẮN GỌN/MƠ HỒ (ví dụ vừa bấm nút gợi ý, hoặc chỉ gõ "tạo banner tuyên truyền" mà chưa mô tả gì thêm) — chưa được tạo sản phẩm ngay. Thay vào đó, hãy tự đưa ra MỘT PHƯƠNG ÁN CỤ THỂ do chính bạn đề xuất: mô tả THẬT ĐẦY ĐỦ, THẬT CHI TIẾT mọi khía cạnh của sản phẩm sắp tạo (chủ đề, đối tượng, phong cách, bối cảnh/hình ảnh/âm thanh/lời thoại tương ứng theo đúng loại sản phẩm — tự suy luận hợp lý các phần người dùng chưa nói rõ, đừng hỏi ngược lại bằng một loạt câu hỏi). Sau phần mô tả kế hoạch đó, LUÔN kết thúc bằng đúng tinh thần câu sau:
  "Bạn có muốn bổ sung gì nữa không? Nếu muốn bổ sung, bạn cứ thoải mái nhập tin nhắn ở khung chat bên dưới. Nếu không cần bổ sung gì thêm, bạn chỉ cần bấm vào nút '🚀 Tạo bài Tuyên truyền ngay!' bên dưới khung chat nhé."
- Nếu người dùng đã tự mô tả SẴN đầy đủ chi tiết ngay từ tin nhắn đầu (không cần bạn phải đoán/đề xuất thay họ), thì cứ tạo sản phẩm hoàn chỉnh luôn, không cần qua bước đề xuất kế hoạch này.
- Khi nhận được tin nhắn xác nhận "tạo ngay" (do người dùng tự gõ thêm, hoặc do họ bấm nút "🚀 Tạo bài Tuyên truyền ngay!" mà hệ thống tự động gửi giùm) — hãy bắt đầu soạn thảo sản phẩm hoàn chỉnh dựa trên đúng phương án bạn vừa đề xuất (kết hợp thêm bất kỳ điều gì người dùng có bổ sung thêm trước đó).

QUY TẮC TRÌNH BÀY BẮT BUỘC CHO NỘI DUNG DẠNG CHỮ (áp dụng cho MỌI sản phẩm ở NHÓM A, và phần lời thoại/kịch bản/nội dung chữ của NHÓM B):
- LUÔN đặt toàn bộ nội dung sản phẩm cuối cùng (bài viết, tin nhắn, khẩu hiệu, hỏi-đáp, kịch bản...) vào TRONG 1 khối mã (bọc bằng \`\`\` ba dấu backtick, không cần ghi tên ngôn ngữ) — KHÔNG được để trực tiếp ngoài bong bóng chat, vì như vậy người dùng bấm sao chép sẽ dính luôn cả câu chữ dẫn nhập của bạn. Khối này sẽ tự động có khung riêng kèm nút "Sao chép" để người dùng lấy đúng nội dung, sạch sẽ.
- Nếu nội dung QUÁ DÀI (ước chừng hơn khoảng 300-400 chữ, ví dụ một bài phát biểu dài, một kịch bản nhiều đoạn, một bài viết chi tiết nhiều phần) thì đừng để trong khối text dài dòng khó đọc nữa — hãy chuyển hẳn sang xuất bằng khối \`\`\`docx (xem hướng dẫn tạo file thật bên dưới) để người dùng tải về thành file Word đọc và chỉnh sửa cho tiện.

VÍ DỤ CẤU TRÚC TRẢ LỜI MẪU khi người dùng VỪA chọn 1 vai trò thuộc NHÓM B (chưa mô tả gì thêm) — hãy trả lời theo tinh thần này (không cần lặp lại y nguyên từng chữ):
"Dạ, Chàng xin đề xuất phương án cho [tên sản phẩm] về chủ đề [chủ đề Chàng tự suy luận hoặc theo đúng ý người dùng] như sau:
- Đối tượng: ...
- Phong cách: ...
- [Các chi tiết đặc thù theo loại sản phẩm: bối cảnh/hình ảnh/âm thanh/lời thoại...]: ...
Bạn có muốn bổ sung gì nữa không? Nếu muốn bổ sung, bạn cứ thoải mái nhập tin nhắn ở khung chat bên dưới. Nếu không cần bổ sung gì thêm, bạn chỉ cần bấm vào nút '🚀 Tạo bài Tuyên truyền ngay!' bên dưới khung chat nhé."

GỢI Ý CÁC KHÍA CẠNH CẦN ĐỀ CẬP KHI ĐỀ XUẤT PHƯƠNG ÁN (NHÓM B) HOẶC KHI SOẠN THẢO (NHÓM A) THEO TỪNG LOẠI SẢN PHẨM — đây là những điều bạn nên TỰ SUY LUẬN và đưa vào phương án đề xuất (NHÓM B) hoặc tự cân nhắc khi viết (NHÓM A), không phải danh sách câu hỏi để hỏi ngược người dùng:
- Bài viết MXH / Tin nhắn Zalo: chủ đề chính sách/nội dung cần truyền tải, độ dài mong muốn (ngắn/vừa/dài), có cần kèm ảnh minh hoạ không.
- Hình ảnh & Poster: mô tả ý tưởng CÀNG CHI TIẾT CÀNG TỐT — khuyến khích mạnh mẽ người dùng tải lên ảnh/tài liệu tham khảo (nếu có) để bạn đọc trực tiếp cho nhanh, dễ hiểu hơn là chỉ mô tả bằng lời; hỏi thêm tông màu ưa thích, có cần chữ/khẩu hiệu in trên ảnh không, dùng để đăng ở đâu (mạng xã hội hay in treo).
- Video tuyên truyền: hỏi người dùng mô tả rõ BỐI CẢNH (diễn ra ở đâu, những ai xuất hiện), mô tả ÂM THANH (nhạc nền, tiếng động nền), và NHÂN VẬT trong video sẽ nói/thoại những câu gì cụ thể; hỏi thêm thời lượng mong muốn.
- Banner: nội dung cần nổi bật nhất, treo ở đâu (ngoài trời/hội trường), kích thước ngang hay dọc, có logo/hình ảnh cụ thể nào cần đưa vào không.
- Kịch bản loa truyền thanh: thời lượng đọc mong muốn, có cần nhạc hiệu mở đầu/kết thúc không.
- Slide trình chiếu: số lượng slide mong muốn, các ý chính cần có trong từng phần, có cần số liệu minh hoạ không.
- Khẩu hiệu/Slogan: chủ đề, số lượng phương án cần gợi ý (mặc định gợi ý khoảng 5-8 phương án để lựa chọn).
- Hỏi - Đáp: những thắc mắc phổ biến nhất mà bà con hay hỏi về chủ đề này, số lượng câu hỏi mong muốn.
- Tạo giọng nói AI: nội dung/kịch bản cần đọc thành giọng nói (nếu người dùng chưa có sẵn kịch bản, hãy tự soạn 1 đoạn văn bản phù hợp để đọc trước), giọng đọc mong muốn nam hay nữ (trình duyệt sẽ tự chọn giọng tiếng Việt có sẵn gần nhất), tốc độ đọc nhanh/vừa/chậm. LUÔN xuất kết quả cuối cùng bằng đúng cú pháp khối \`\`\`voice (xem hướng dẫn bên dưới) để người dùng bấm nghe được giọng đọc AI thật ngay trong trình duyệt.

VÍ DỤ CẤU TRÚC TRẢ LỜI MẪU khi người dùng VỪA chọn 1 vai trò (chưa cung cấp đủ thông tin) — hãy trả lời theo tinh thần này (không cần lặp lại y nguyên từng chữ):
"Dạ, [tên tính năng] sẽ giúp anh/chị [1 câu mô tả lợi ích cụ thể]! Để Chàng biên soạn cho thật sát và đúng ý, anh/chị cho Chàng biết thêm:
1. [câu hỏi thông tin cụ thể 1]
2. [câu hỏi thông tin cụ thể 2]
3. Sản phẩm này chủ yếu dành cho đối tượng nào ạ (hội viên nông dân, thanh niên, phụ nữ, người cao tuổi, hay bà con nói chung)?
4. Anh/chị muốn giọng văn gần gũi, mộc mạc hay trang trọng, nghiêm túc ạ?
(Anh/chị có thể trả lời từng ý, hoặc gửi luôn ảnh/tài liệu liên quan để Chàng đọc cho nhanh nhé!)"

PHONG CÁCH VIẾT MẶC ĐỊNH (áp dụng khi soạn thảo sản phẩm hoàn chỉnh, trừ khi người dùng yêu cầu phong cách khác):
- Gần gũi, mộc mạc, đúng chất "nói chuyện với bà con" — như một cán bộ Hội Nông dân thân quen đang trò chuyện, KHÔNG hàn lâm, KHÔNG dùng nhiều từ Hán Việt khó hiểu, KHÔNG giáo điều cứng nhắc.
- Có thể lồng ghép ca dao/tục ngữ/thành ngữ quen thuộc của người Việt khi phù hợp để tăng sự gần gũi, dễ nhớ.
- Luôn nhấn mạnh LỢI ÍCH THIẾT THỰC, CỤ THỂ mà chính sách/phong trào mang lại cho bà con — tránh nói chung chung, sáo rỗng.
- Luôn có lời kêu gọi hành động rõ ràng ở cuối (call-to-action), ví dụ: "Bà con nhớ...", "Mời bà con...", "Hãy cùng nhau...", "Liên hệ ngay Chi hội/Tổ hội để được hướng dẫn thêm nhé!".
- Với bài đăng mạng xã hội: có thể gợi ý thêm 1-2 hashtag phù hợp (vd #HộiNôngDân #NôngThônMới #ChungTay...).
- Luôn dùng tiếng Việt chuẩn mực, không sai chính tả, không dùng ngôn ngữ nhạy cảm, kích động, hoặc trái chủ trương/pháp luật.
- Nếu người dùng yêu cầu phong cách khác (trẻ trung, hài hước, trang trọng cấp cao...), hãy tôn trọng và điều chỉnh theo đúng ý họ.

SAU KHI SOẠN XONG sản phẩm hoàn chỉnh: trình bày rõ ràng, dùng markdown hợp lý (in đậm ý chính, gạch đầu dòng khi liệt kê), và luôn hỏi thêm ở cuối: "Anh/chị xem đã ưng ý chưa, có cần Chàng chỉnh sửa gì thêm không ạ?"

NẾU NGƯỜI DÙNG TỰ GÕ TIN NHẮN TỰ DO (không bấm nút gợi ý nào): vẫn luôn giữ đúng tinh thần Module này — hướng mọi nội dung về mục đích tuyên truyền chính sách/pháp luật/quy định/phong trào; nếu họ hỏi điều gì đó hoàn toàn không liên quan tới tuyên truyền/truyền thông, hãy lịch sự nhắc đây là không gian chuyên biên soạn nội dung tuyên truyền và gợi ý họ dùng Module "Chàng Nông dân Thông minh" (Chat AI chung) cho các câu hỏi khác.
Riêng với yêu cầu "🖥️ Slide trình chiếu": sau khi đã hỏi đủ thông tin (số lượng slide, nội dung chính từng phần...), hãy LUÔN xuất kết quả cuối cùng bằng đúng cú pháp khối \`\`\`pptx bên dưới để người dùng tải được file PowerPoint thật, không chỉ mô tả suông bằng chữ.
Luôn trả lời bằng tiếng Việt.${knowledgeBlock}
${fileGenerationTrainingText()}`;
  }

  // Các "vai trò" gợi ý sẵn — bấm vào 1 nút là hệ thống tự soạn + tự gửi luôn 1 câu yêu cầu tương ứng.
  const PROPAGANDA_ROLES = [
    { key:'social', icon:'📱', label:'Bài viết tuyên truyền MXH', prompt:'Tôi muốn tạo một bài viết tuyên truyền để đăng trên mạng xã hội (Facebook, Zalo...).' },
    { key:'zalo', icon:'💬', label:'Tin nhắn Zalo/Messenger', prompt:'Tôi muốn tạo một tin nhắn tuyên truyền ngắn gọn để gửi qua Zalo/Messenger.' },
    { key:'poster', icon:'🖼️', label:'Hình ảnh & Poster', prompt:'Tôi muốn tạo hình ảnh/poster tuyên truyền.' },
    { key:'video', icon:'🎬', label:'Video tuyên truyền', prompt:'Tôi muốn tạo một video tuyên truyền.' },
    { key:'banner', icon:'🪧', label:'Banner tuyên truyền', prompt:'Tôi muốn tạo banner/băng rôn tuyên truyền.' },
    { key:'radio', icon:'📢', label:'Kịch bản loa truyền thanh', prompt:'Tôi muốn tạo kịch bản đọc trên loa truyền thanh/phát thanh xã.' },
    { key:'voice', icon:'🎙️', label:'Tạo giọng nói AI', prompt:'Tôi muốn tạo giọng nói AI đọc nội dung tuyên truyền.' },
    { key:'slide', icon:'🖥️', label:'Slide trình chiếu', prompt:'Tôi muốn tạo nội dung slide trình chiếu tuyên truyền cho buổi họp/hội nghị.' },
    { key:'slogan', icon:'💡', label:'Khẩu hiệu / Slogan', prompt:'Tôi muốn nghĩ ra khẩu hiệu/slogan tuyên truyền ngắn gọn, dễ nhớ.' },
    { key:'qa', icon:'❓', label:'Hỏi - Đáp tuyên truyền', prompt:'Tôi muốn tạo bộ câu hỏi - đáp để tuyên truyền, giải đáp thắc mắc cho bà con.' },
    { key:'proverb', icon:'🌾', label:'Ca dao tuyên truyền', prompt:'Tôi muốn sáng tác ca dao tuyên truyền, dễ nhớ dễ thuộc theo phong cách dân gian.' },
    { key:'poem', icon:'📜', label:'Bài thơ tuyên truyền', prompt:'Tôi muốn sáng tác một bài thơ tuyên truyền.' },
    { key:'music', icon:'🎵', label:'Âm nhạc tuyên truyền', prompt:'Tôi muốn sáng tác lời bài hát/âm nhạc tuyên truyền.' },
  ];

  async function loadPropagandaChats(){
    if(!state.identity || !state.identity.email){ state.propagandaChats = state.propagandaChats||[]; return; }
    try{
      const snap = await rtdb.ref(`users/${emailToKey(state.identity.email)}/propagandaChats`).get();
      state.propagandaChats = (snap && snap.exists()) ? Object.entries(snap.val()).map(([id,v])=>({id, ...v})).sort((a,b)=> new Date(b.updatedAt||0)-new Date(a.updatedAt||0)) : [];
    }catch(e){ state.propagandaChats = []; }
  }
  async function savePropagandaChatToCloud(chat){
    if(!state.identity || !state.identity.email) return;
    try{ await rtdb.ref(`users/${emailToKey(state.identity.email)}/propagandaChats/${chat.id}`).set(chat); }catch(e){ console.error('Lưu đoạn tuyên truyền lỗi:', e); }
  }
  function newPropagandaChat(){
    state.propagandaActiveChatId = null;
    state._propagandaBubbleEditingIndex = null;
    renderPropagandaOverlay();
  }
  async function deletePropagandaChatById(chatId){
    if(!confirm('Xoá đoạn hội thoại tuyên truyền này?')) return;
    state.propagandaChats = state.propagandaChats.filter(c=>c.id!==chatId);
    if(state.propagandaActiveChatId===chatId) state.propagandaActiveChatId = state.propagandaChats[0] ? state.propagandaChats[0].id : null;
    if(state.identity && state.identity.email){ try{ await rtdb.ref(`users/${emailToKey(state.identity.email)}/propagandaChats/${chatId}`).remove(); }catch(e){} }
    renderPropagandaOverlay();
  }
  function renamePropagandaChat(chatId){
    const chat = state.propagandaChats.find(c=>c.id===chatId);
    if(!chat) return;
    const name = prompt('Đổi tên đoạn hội thoại:', chat.title||'');
    if(name===null || !name.trim()) return;
    chat.title = name.trim().slice(0,60);
    renderPropagandaOverlay();
    savePropagandaChatToCloud(chat);
  }
  function getActivePropagandaProvider(){
    if(!state.aiProviders || !state.aiProviders.length) return null;
    return state.aiProviders.find(p=>p.id===state.propagandaActiveProviderId) || state.aiProviders[0];
  }
  function selectPropagandaProvider(id){
    state.propagandaActiveProviderId = id;
    lset('hnd_propaganda_active_provider', id);
    state._propagandaModelMenuOpen = false;
    renderPropagandaOverlay();
  }
  async function runPropagandaAssistantTurn(chat, attachmentsForApi){
    state.propagandaSending = true;
    state.propagandaAbortController = new AbortController();
    const assistantMsg = { role:'assistant', text:'', time:new Date().toISOString(), streaming:true };
    chat.messages.push(assistantMsg);
    renderPropagandaOverlay();
    const sysPrompt = await buildPropagandaSystemPrompt();
    try{
      const result = await callAIWithFallback(chat.messages.slice(0,-1), { attachments: attachmentsForApi||[], webSearch: state.propagandaWebSearchOn, systemPromptOverride: sysPrompt, signal: state.propagandaAbortController.signal }, (partial)=>{
        assistantMsg.text = partial;
        const bubbleEl = document.getElementById('pg-streaming-bubble');
        if(bubbleEl){
          if(partial){ bubbleEl.classList.remove('thinking'); bubbleEl.textContent = partial; }
          else { bubbleEl.classList.add('thinking'); bubbleEl.innerHTML = waveTextHtml('Chàng đang biên tập…'); }
          const msgBox = document.getElementById('pg-messages'); if(msgBox) msgBox.scrollTop = msgBox.scrollHeight;
        }
      });
      assistantMsg.text = result.text;
    }catch(e){
      assistantMsg.text = (e && e.name==='AbortError') ? 'Bạn đã dừng câu trả lời này.' : 'Xin lỗi, đã có lỗi xảy ra khi trả lời. Bạn thử lại nhé.';
    }
    delete assistantMsg.streaming;
    chat.updatedAt = new Date().toISOString();
    state.propagandaSending = false;
    state.propagandaAbortController = null;
    renderPropagandaOverlay();
    savePropagandaChatToCloud(chat);
  }
  async function sendPropagandaMessage(text, forceVideoFlag){
    const hasText = !!(text && text.trim());
    if(!hasText && !state.propagandaPendingAttachments.length) return;
    if(state.propagandaSending) return;
    let chat = state.propagandaChats.find(c=>c.id===state.propagandaActiveChatId);
    if(!chat){
      chat = { id:'pc_'+uid(), title:(text||'').trim().slice(0,40) || 'Bài tuyên truyền mới', messages:[], updatedAt:new Date().toISOString() };
      state.propagandaChats.unshift(chat);
      state.propagandaActiveChatId = chat.id;
    }
    // Yêu cầu mới: hễ đoạn chat có nhắc tới "video" (bấm nút vai trò Video, hoặc tự gõ có chữ
    // "video") thì đánh dấu để hiện banner cảnh báo tính năng cao cấp đang nâng cấp, cố định từ
    // đó về sau trong đúng đoạn chat này.
    if(forceVideoFlag || /video/i.test(text||'')) chat.hasVideoRole = true;
    const attachmentsForApi = state.propagandaPendingAttachments.slice();
    const attachmentsForHistory = attachmentsForApi.map(a=>({ name:a.name, mimeType:a.mimeType }));
    chat.messages.push({ role:'user', text:(text||'').trim(), time:new Date().toISOString(), attachments: attachmentsForHistory });
    chat.updatedAt = new Date().toISOString();
    state.propagandaPendingAttachments = [];
    await runPropagandaAssistantTurn(chat, attachmentsForApi);
  }
  function deletePropagandaMessageAt(idx){
    if(!confirm('Xoá tin nhắn này? Thao tác này KHÔNG THỂ hoàn tác.')) return;
    const chat = state.propagandaChats.find(c=>c.id===state.propagandaActiveChatId);
    if(!chat || !chat.messages[idx]) return;
    chat.messages.splice(idx,1);
    chat.updatedAt = new Date().toISOString();
    renderPropagandaOverlay();
    savePropagandaChatToCloud(chat);
  }
  function startEditPropagandaMessage(idx){ state._propagandaBubbleEditingIndex = idx; renderPropagandaOverlay(); }
  function cancelEditPropagandaMessage(){ state._propagandaBubbleEditingIndex = null; renderPropagandaOverlay(); }
  async function resendEditedPropagandaMessage(idx, newText){
    if(!newText || !newText.trim()) return;
    const chat = state.propagandaChats.find(c=>c.id===state.propagandaActiveChatId);
    if(!chat) return;
    chat.messages = chat.messages.slice(0, idx);
    state._propagandaBubbleEditingIndex = null;
    await sendPropagandaMessage(newText.trim());
  }
  function triggerPropagandaFileInput(kind){
    state._propagandaAddMenuOpen = false;
    renderPropagandaOverlay();
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = kind==='image' ? 'image/*' : '*/*';
    input.onchange = ()=> handlePropagandaFiles(input.files);
    input.click();
  }
  function handlePropagandaFiles(fileList){
    const files = Array.from(fileList||[]);
    if(!files.length) return;
    const MAX_MB = 8;
    files.forEach(file=>{
      if(file.size > MAX_MB*1024*1024){ alert(`Tệp "${file.name}" vượt quá ${MAX_MB}MB, vui lòng chọn tệp nhỏ hơn.`); return; }
      const reader = new FileReader();
      reader.onload = ()=>{
        const base64 = String(reader.result).split(',')[1] || '';
        state.propagandaPendingAttachments.push({ name:file.name, mimeType: file.type || 'application/octet-stream', base64 });
        renderPropagandaOverlay();
      };
      reader.onerror = ()=> alert(`Không đọc được tệp "${file.name}".`);
      reader.readAsDataURL(file);
    });
  }
  function removePropagandaAttachment(idx){
    state.propagandaPendingAttachments.splice(idx,1);
    renderPropagandaOverlay();
  }
  // Gọi Gemini API bằng ĐÚNG Cấu hình AI (model) mà người dùng đang chọn ở thanh model phía trên
  // ô nhập liệu. opts.attachments: tệp/ảnh đính kèm cho tin nhắn CUỐI CÙNG. opts.webSearch: bật
  // Google Search grounding (chế độ "Tìm kiếm web") cho lượt trả lời này.
  // ---------------------------------------------------------------------
  // Nhận diện "hãng" của 1 Cấu hình AI dựa trên tên model/tên gợi nhớ mà Admin đã nhập, để hệ
  // thống tự biết đâu là API Key Gemini, đâu là ChatGPT (OpenAI), đâu là Claude (Anthropic)...
  // ---------------------------------------------------------------------
  function aiVendorOf(p){
    const s = (((p&&p.model)||'') + ' ' + ((p&&p.label)||'')).toLowerCase();
    if(s.includes('gemini')) return 'gemini';
    if(s.includes('gpt') || s.includes('openai') || s.includes('chatgpt') || /\bo[134]\b/.test(s)) return 'openai';
    if(s.includes('claude') || s.includes('anthropic')) return 'anthropic';
    return 'unknown';
  }

  // Gọi 1 lượt Gemini duy nhất theo cơ chế STREAMING (:streamGenerateContent?alt=sse) — đọc từng
  // đoạn nhỏ ngay khi AI vừa xử lý xong, gọi onDelta(fullTextSoFar) liên tục để giao diện tuôn chữ
  // mượt mà. LƯU Ý: hàm này THROW lỗi (không tự bắt) để hàm điều phối bên ngoài quyết định có
  // chuyển sang tầng dự phòng tiếp theo hay không.
  async function callGeminiOnce(provider, model, messages, opts, onDelta){
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${provider.apiKey}`;
    const contents = messages.map((m,i)=>{
      const parts = [{text:m.text||''}];
      if(i===messages.length-1 && opts.attachments && opts.attachments.length){
        opts.attachments.forEach(a=> parts.push({ inline_data:{ mime_type:a.mimeType, data:a.base64 } }));
      }
      return { role: m.role==='assistant' ? 'model' : 'user', parts };
    });
    const body = { system_instruction:{ parts:[{text: opts.systemPromptOverride || await buildAiSystemPrompt()}] }, contents };
    if(opts.webSearch) body.tools = [{ google_search:{} }]; // chế độ "Tìm kiếm web" — chỉ hoạt động với các model Gemini có hỗ trợ grounding
    const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body), signal: opts.signal });
    if(!res.ok){
      let msg = `HTTP ${res.status}`;
      try{ const errData = await res.json(); msg = (errData && errData.error && errData.error.message) || (Array.isArray(errData) && errData[0] && errData[0].error && errData[0].error.message) || msg; }catch(e){}
      throw new Error(`[Gemini ${model}] ${msg}`);
    }
    let fullText = '';
    if(!res.body || !res.body.getReader){
      // Môi trường không hỗ trợ đọc luồng (hiếm gặp) -> rơi về đọc trọn gói 1 lần cho an toàn
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [data];
      arr.forEach(obj=>{
        if(obj && obj.error) throw new Error(`[Gemini ${model}] ${obj.error.message || 'lỗi không xác định'}`);
        const parts = obj && obj.candidates && obj.candidates[0] && obj.candidates[0].content && obj.candidates[0].content.parts;
        if(parts) fullText += parts.map(p=>p.text||'').join('');
      });
      if(onDelta) onDelta(fullText);
      if(!fullText.trim()) throw new Error(`[Gemini ${model}] Không có nội dung trả về (có thể bị chặn an toàn hoặc quá tải).`);
      return { text: fullText.trim() };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while(true){
      const { done, value } = await reader.read();
      if(done) break;
      buffer += decoder.decode(value, { stream:true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // giữ lại phần dòng còn dở dang cho lượt đọc kế tiếp
      for(const line of lines){
        const trimmed = line.trim();
        if(!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if(!jsonStr) continue;
        let obj;
        try{ obj = JSON.parse(jsonStr); }catch(e){ continue; /* dòng chưa trọn vẹn — đợi chunk sau */ }
        if(obj.error) throw new Error(`[Gemini ${model}] ${obj.error.message || 'lỗi không xác định'}`);
        const parts = obj.candidates && obj.candidates[0] && obj.candidates[0].content && obj.candidates[0].content.parts;
        if(parts){
          const deltaText = parts.map(p=>p.text||'').join('');
          if(deltaText){ fullText += deltaText; if(onDelta) onDelta(fullText); }
        }
      }
    }
    if(!fullText.trim()) throw new Error(`[Gemini ${model}] Không có nội dung trả về (có thể bị chặn an toàn hoặc quá tải).`);
    return { text: fullText.trim() };
  }

  // Nếu Admin gõ chung chung/sai ("chatgpt", "gpt", để trống...) thì OpenAI sẽ báo lỗi 400
  // "invalid model ID" ngay lập tức — tự động ép về 1 Model ID CỤ THỂ, hợp lệ. LƯU Ý: model
  // "gpt-4o-mini" đã ngừng được khuyến nghị (OpenAI đang chuyển hẳn sang dòng GPT-5), model thay
  // thế hiện hành cho nhu cầu chi phí thấp/độ trễ thấp là "gpt-5-mini".
  function sanitizeOpenAIModel(raw){
    const m = (raw||'').trim();
    const invalid = ['', 'chatgpt', 'chat gpt', 'chat-gpt', 'gpt', 'gpt chat', 'openai', 'chat gpt 4', 'gpt4', 'gpt-4'];
    if(invalid.includes(m.toLowerCase())) return 'gpt-5-mini';
    return m;
  }
  // Gọi 1 lượt OpenAI (ChatGPT) — chuẩn Chat Completions, cũng hỗ trợ streaming SSE. THROW lỗi
  // khi thất bại, để hàm điều phối quyết định tầng kế tiếp.
  async function callOpenAIOnce(provider, messages, opts, onDelta){
    const model = sanitizeOpenAIModel(provider.model);
    const oaMessages = [{ role:'system', content: opts.systemPromptOverride || await buildAiSystemPrompt() }];
    messages.forEach((m,i)=>{
      if(i===messages.length-1 && opts.attachments && opts.attachments.length){
        const contentArr = [{ type:'text', text:m.text||'' }];
        opts.attachments.forEach(a=>{
          if((a.mimeType||'').startsWith('image/')) contentArr.push({ type:'image_url', image_url:{ url:`data:${a.mimeType};base64,${a.base64}` } });
        });
        oaMessages.push({ role: m.role==='assistant'?'assistant':'user', content: contentArr });
      } else {
        oaMessages.push({ role: m.role==='assistant'?'assistant':'user', content: m.text||'' });
      }
    });
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', 'Authorization': `Bearer ${provider.apiKey}` },
      body: JSON.stringify({ model, messages: oaMessages, stream:true }),
      signal: opts.signal,
    });
    if(!res.ok){
      let msg = `HTTP ${res.status}`;
      try{ const errData = await res.json(); msg = (errData && errData.error && errData.error.message) || msg; }catch(e){}
      throw new Error(`[OpenAI ${model}] ${msg}`);
    }
    let fullText = '';
    if(!res.body || !res.body.getReader){
      const data = await res.json();
      fullText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '';
      if(onDelta) onDelta(fullText);
      if(!fullText.trim()) throw new Error(`[OpenAI ${model}] Không có nội dung trả về.`);
      return { text: fullText.trim() };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while(true){
      const { done, value } = await reader.read();
      if(done) break;
      buffer += decoder.decode(value, { stream:true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for(const line of lines){
        const trimmed = line.trim();
        if(!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if(!jsonStr || jsonStr==='[DONE]') continue;
        let obj;
        try{ obj = JSON.parse(jsonStr); }catch(e){ continue; }
        if(obj.error) throw new Error(`[OpenAI ${model}] ${obj.error.message || 'lỗi không xác định'}`);
        const deltaText = obj.choices && obj.choices[0] && obj.choices[0].delta && obj.choices[0].delta.content;
        if(deltaText){ fullText += deltaText; if(onDelta) onDelta(fullText); }
      }
    }
    if(!fullText.trim()) throw new Error(`[OpenAI ${model}] Không có nội dung trả về.`);
    return { text: fullText.trim() };
  }

  // Gọi 1 lượt Anthropic (Claude) — chuẩn Messages API, hỗ trợ streaming SSE. THROW lỗi khi thất bại.
  async function callAnthropicOnce(provider, messages, opts, onDelta){
    const model = provider.model || 'claude-3-5-sonnet-20241022';
    const anthMessages = messages.map((m,i)=>{
      if(i===messages.length-1 && opts.attachments && opts.attachments.length){
        const contentArr = [{ type:'text', text:m.text||'' }];
        opts.attachments.forEach(a=>{
          if((a.mimeType||'').startsWith('image/')) contentArr.push({ type:'image', source:{ type:'base64', media_type:a.mimeType, data:a.base64 } });
        });
        return { role: m.role==='assistant'?'assistant':'user', content: contentArr };
      }
      return { role: m.role==='assistant'?'assistant':'user', content: m.text||'' };
    });
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{
        'Content-Type':'application/json', 'x-api-key': provider.apiKey,
        'anthropic-version':'2023-06-01', 'anthropic-dangerous-direct-browser-access':'true',
      },
      body: JSON.stringify({ model, max_tokens:4096, system: opts.systemPromptOverride || await buildAiSystemPrompt(), messages: anthMessages, stream:true }),
      signal: opts.signal,
    });
    if(!res.ok){
      let msg = `HTTP ${res.status}`;
      try{ const errData = await res.json(); msg = (errData && errData.error && errData.error.message) || msg; }catch(e){}
      throw new Error(`[Claude ${model}] ${msg}`);
    }
    let fullText = '';
    if(!res.body || !res.body.getReader){
      const data = await res.json();
      fullText = (data.content||[]).map(c=>c.text||'').join('');
      if(onDelta) onDelta(fullText);
      if(!fullText.trim()) throw new Error(`[Claude ${model}] Không có nội dung trả về.`);
      return { text: fullText.trim() };
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';
    while(true){
      const { done, value } = await reader.read();
      if(done) break;
      buffer += decoder.decode(value, { stream:true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for(const line of lines){
        const trimmed = line.trim();
        if(!trimmed.startsWith('data:')) continue;
        const jsonStr = trimmed.slice(5).trim();
        if(!jsonStr) continue;
        let obj;
        try{ obj = JSON.parse(jsonStr); }catch(e){ continue; }
        if(obj.type==='content_block_delta' && obj.delta && obj.delta.text){ fullText += obj.delta.text; if(onDelta) onDelta(fullText); }
        else if(obj.type==='error'){ throw new Error(`[Claude ${model}] ${(obj.error && obj.error.message) || 'lỗi không xác định'}`); }
      }
    }
    if(!fullText.trim()) throw new Error(`[Claude ${model}] Không có nội dung trả về.`);
    return { text: fullText.trim() };
  }

  // ---------------------------------------------------------------------
  // BỘ ĐIỀU PHỐI "DỰ PHÒNG TỰ ĐỘNG 3 TẦNG" — đây là hàm DUY NHẤT mà giao diện chat gọi tới.
  // TẦNG 1: gemini-pro-latest (API Key Gemini trong Cấu hình AI).
  // TẦNG 2: nếu Tầng 1 lỗi bất kỳ kiểu gì (quá tải, 429, 503, 404 model đã ngừng hỗ trợ, mất
  //         mạng...) -> ÂM THẦM chuyển sang gemini-flash-latest, dùng CHUNG API Key Gemini đó.
  // TẦNG 3: nếu Tầng 2 cũng lỗi -> kiểm tra trong Cấu hình AI có API Key của hãng khác không (vd
  //         ChatGPT/Claude); nếu có thì âm thầm gọi hãng đó để "cứu nguy"; nếu không có gì khác
  //         ngoài đúng 1 API Key Gemini thì mới báo lỗi thân thiện cho người dùng.
  // LƯU Ý QUAN TRỌNG: dùng alias "-latest" (gemini-pro-latest / gemini-flash-latest) thay vì ghim
  // cứng 1 phiên bản cụ thể (như "gemini-1.5-pro") — vì Google đổi/khai tử phiên bản Gemini rất
  // nhanh (chỉ trong vài tháng), ghim cứng version cụ thể sẽ tái diễn lỗi 404 "model not found"
  // sau một thời gian. Alias "-latest" tự động trỏ sang bản mới nhất Google phát hành, có báo
  // trước 2 tuần khi đổi model đứng sau alias — không cần sửa code lại mỗi khi Google nâng cấp.
  // Toàn bộ quá trình chuyển tầng diễn ra NGẦM — người dùng không thấy bất kỳ cảnh báo lỗi đỏ nào,
  // chỉ thấy bong bóng "đang suy nghĩ" hơi lâu hơn bình thường rồi có câu trả lời bình thường.
  // Ngoại lệ: nếu người dùng tự tay CHỌN đích danh 1 model không phải Gemini ở thanh chọn model,
  // hệ thống tôn trọng đúng lựa chọn đó (không tự ý chuyển sang Gemini).
  // ---------------------------------------------------------------------
  async function callAIWithFallback(messages, opts, onDelta){
    opts = opts || {};
    if(!state.aiProviders || !state.aiProviders.length) await loadAiProviders();
    const providers = state.aiProviders || [];
    if(!providers.length){
      return { text:'Admin chưa cấu hình API AI nào. Vui lòng vào Module "CÀI ĐẶT ADMIN → Cấu hình AI" để thêm API Key.' };
    }
    const selected = getActiveAiProvider();
    const selectedVendor = selected ? aiVendorOf(selected) : null;

    // Người dùng tự chọn đích danh 1 model KHÔNG PHẢI Gemini -> tôn trọng lựa chọn, không áp dụng
    // cơ chế 3 tầng dành riêng cho Gemini (cơ chế này chỉ để chống nghẽn/quá tải của Gemini).
    if(selected && selectedVendor && selectedVendor !== 'gemini'){
      try{
        if(selectedVendor==='anthropic') return await callAnthropicOnce(selected, messages, opts, onDelta);
        return await callOpenAIOnce(selected, messages, opts, onDelta);
      }catch(e){
        if(e && e.name==='AbortError') throw e; // người dùng chủ động dừng -> KHÔNG dò tầng khác
        console.error('[AI] Model đang chọn gặp lỗi:', e);
        return { text:'Xin lỗi, hệ thống AI đang gặp sự cố với model đang chọn. Bạn thử lại sau ít phút hoặc đổi sang model khác ở thanh chọn model phía trên nhé.' };
      }
    }

    const geminiProvider = (selected && selectedVendor==='gemini') ? selected : providers.find(p=> p.apiKey && aiVendorOf(p)==='gemini');

    if(geminiProvider && geminiProvider.apiKey){
      // ---- TẦNG 1: gemini-pro-latest ----
      try{
        return await callGeminiOnce(geminiProvider, 'gemini-pro-latest', messages, opts, onDelta);
      }catch(e1){
        if(e1 && e1.name==='AbortError') throw e1; // người dùng chủ động dừng -> KHÔNG dò tầng khác
        console.warn('[AI Fallback] Tầng 1 (gemini-pro-latest) lỗi -> âm thầm chuyển Tầng 2:', e1);
        if(onDelta) onDelta(''); // đưa bong bóng về lại trạng thái "đang suy nghĩ" trong lúc chuyển tầng
        // ---- TẦNG 2: gemini-flash-latest (dùng chung API Key Gemini) ----
        try{
          return await callGeminiOnce(geminiProvider, 'gemini-flash-latest', messages, opts, onDelta);
        }catch(e2){
          if(e2 && e2.name==='AbortError') throw e2;
          console.warn('[AI Fallback] Tầng 2 (gemini-flash-latest) cũng lỗi -> âm thầm chuyển Tầng 3:', e2);
          if(onDelta) onDelta('');
        }
      }
    }

    // ---- TẦNG 3: hãng khác trong Cấu hình AI (nếu Admin có gắn thêm, vd ChatGPT/Claude) ----
    const otherProvider = providers.find(p=> p!==geminiProvider && p.apiKey && aiVendorOf(p)!=='gemini');
    if(otherProvider){
      try{
        const vendor = aiVendorOf(otherProvider);
        if(vendor==='anthropic') return await callAnthropicOnce(otherProvider, messages, opts, onDelta);
        return await callOpenAIOnce(otherProvider, messages, opts, onDelta);
      }catch(e3){
        if(e3 && e3.name==='AbortError') throw e3;
        console.error('[AI Fallback] Tầng 3 (hãng khác) cũng lỗi:', e3);
      }
    }

    if(!geminiProvider){
      return { text:'Admin chưa cấu hình API AI Gemini hợp lệ. Vui lòng vào Module "CÀI ĐẶT ADMIN → Cấu hình AI" để thêm API Key.' };
    }
    // Chỉ có ĐÚNG 1 API Key Gemini (không có hãng nào khác để cứu nguy) và cả 2 tầng Gemini đều lỗi.
    return { text:'Xin lỗi, hệ thống AI hiện đang quá tải, chưa thể trả lời ngay lúc này. Bạn vui lòng thử lại sau ít phút nhé!' };
  }
  // Thực hiện 1 lượt gọi AI trả lời cho đúng trạng thái `chat.messages` HIỆN TẠI (không tự thêm
  // tin nhắn người dùng nào) — dùng chung cho: gửi tin nhắn mới, gửi lại sau khi sửa, và "Tải lại"
  // (yêu cầu AI trả lời lại cho đúng câu hỏi cũ).
  async function runAssistantTurn(chat, attachmentsForApi){
    state.aiSending = true;
    state.aiAbortController = new AbortController();
    const assistantMsg = { role:'assistant', text:'', time:new Date().toISOString(), streaming:true };
    chat.messages.push(assistantMsg);
    renderAiChatOverlay();
    try{
      const result = await callAIWithFallback(chat.messages.slice(0,-1), { attachments: attachmentsForApi||[], webSearch: state.aiWebSearchOn, signal: state.aiAbortController.signal }, (partial)=>{
        assistantMsg.text = partial;
        const bubbleEl = document.getElementById('ai-streaming-bubble');
        if(bubbleEl){
          if(partial){
            bubbleEl.classList.remove('thinking');
            bubbleEl.textContent = partial;
          } else {
            bubbleEl.classList.add('thinking');
            bubbleEl.innerHTML = waveTextHtml('Chàng đang suy nghĩ…');
          }
          const msgBox = document.getElementById('ai-messages');
          if(msgBox) msgBox.scrollTop = msgBox.scrollHeight;
        }
      });
      assistantMsg.text = result.text;
    }catch(e){
      assistantMsg.text = (e && e.name==='AbortError') ? 'Bạn đã dừng câu trả lời này.' : 'Xin lỗi, đã có lỗi xảy ra khi trả lời. Bạn thử lại nhé.';
    }
    delete assistantMsg.streaming;
    chat.updatedAt = new Date().toISOString();
    state.aiSending = false;
    state.aiAbortController = null;
    renderAiChatOverlay();
    saveAiChatToCloud(chat);
    // Yêu cầu 7: sau lượt trao đổi ĐẦU TIÊN của 1 đoạn chat mới, để AI tự đặt tên ngắn gọn cho
    // đoạn chat đó (giống các mô hình AI hiện nay), thay vì chỉ lấy tạm mấy chữ đầu câu hỏi.
    if(chat.messages.filter(m=>m.role==='user').length===1 && chat.messages.filter(m=>m.role==='assistant').length===1){
      generateChatTitle(chat);
    }
  }
  async function sendAiMessage(text){
    const hasText = !!(text && text.trim());
    if(!hasText && !state.aiPendingAttachments.length) return;
    if(state.aiSending) return;
    let chat = state.aiChats.find(c=>c.id===state.aiActiveChatId);
    if(!chat){ chat = { id:'c_'+uid(), title:'Đoạn chat mới', messages:[], updatedAt:new Date().toISOString() }; state.aiChats.unshift(chat); state.aiActiveChatId = chat.id; }
    const attachmentsForApi = state.aiPendingAttachments.slice();
    // Chỉ lưu TÊN + LOẠI tệp vào lịch sử (không lưu base64) để tránh phình dung lượng Firebase —
    // nội dung thật chỉ dùng ngay cho lượt gọi AI này.
    const attachmentsForHistory = attachmentsForApi.map(a=>({ name:a.name, mimeType:a.mimeType }));
    chat.messages.push({ role:'user', text: (text||'').trim(), time:new Date().toISOString(), attachments: attachmentsForHistory });
    if(chat.messages.length===1) chat.title = (text||'').trim().slice(0,40) || (attachmentsForHistory[0] && attachmentsForHistory[0].name) || 'Đoạn chat mới';
    chat.updatedAt = new Date().toISOString();
    state.aiPendingAttachments = [];
    await runAssistantTurn(chat, attachmentsForApi);
  }

  // ---------------------------------------------------------------------
  // Toast thông báo nhanh (dùng chung toàn app) + sao chép vào clipboard.
  // ---------------------------------------------------------------------
  // "Hệ thống đang xử lý..." — thông báo nhỏ KHÔNG tự đóng, hiện giữa màn hình trong lúc hệ thống
  // đang thực sự lập Biên lai/Giấy xác nhận/tính toán kết quả (bước 2-3 trong quy trình 4 bước).
  // pointer-events:none để người dùng vẫn thao tác/bấm được mọi nơi khác trong lúc chờ.
  function showProcessingToast(){
    hideProcessingToast();
    const el = document.createElement('div');
    el.id = '__processingToast';
    el.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:99999; background:#c8e6c9; color:#000; padding:16px 30px; border-radius:14px; box-shadow:0 6px 24px rgba(0,0,0,.28); font-weight:700; font-size:15px; pointer-events:none; text-align:center;';
    el.innerHTML = waveTextHtml('Hệ thống đang xử lý...');
    document.body.appendChild(el);
    // LƯỚI BẢO VỆ: nếu vì lý do gì đó (lỗi ngoại lệ giữa chừng...) mà hideProcessingToast() không bao
    // giờ được gọi, tự động tắt sau tối đa 20 giây — không để thông báo kẹt lại vĩnh viễn trên màn hình.
    if(window.__processingToastTimer) clearTimeout(window.__processingToastTimer);
    window.__processingToastTimer = setTimeout(()=>{ hideProcessingToast(); }, 20000);
  }
  function hideProcessingToast(){
    const el = document.getElementById('__processingToast');
    if(el) el.remove();
    if(window.__processingToastTimer){ clearTimeout(window.__processingToastTimer); window.__processingToastTimer = null; }
  }
  function showToast(msg){
    const old = document.getElementById('hnd-toast');
    if(old) old.remove();
    const toast = document.createElement('div');
    toast.id = 'hnd-toast';
    toast.className = 'hnd-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);
    requestAnimationFrame(()=> toast.classList.add('show'));
    setTimeout(()=>{ toast.classList.remove('show'); setTimeout(()=>{ if(toast.parentNode) toast.remove(); }, 300); }, 1800);
  }
  // Thông báo LỚN dùng cho các sự kiện quan trọng (gia hạn thành công, phê duyệt đóng lãi thành
  // công) — nhảy sổ ra giữa màn hình + nhảy múa 1 giây, đứng im 4 giây, rồi mờ dần và biến mất.
  function showBigToast(msg){
    const el = document.createElement('div');
    el.className = 'big-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(()=>{
      el.classList.add('big-toast-fading');
      setTimeout(()=>{ if(el.parentNode) el.remove(); }, 1200); // khớp đúng thời lượng animation trôi xuống mới (1.2s)
    }, 1000 + 4000);
  }
  // Thông báo nhỏ "Bạn đang ở trong ..." — hiện 2 giây rồi tự biến mất, dùng khi mở modal hoặc
  // chuyển đổi giữa các Nhóm/Tab trong các modal có nhiều khung nội dung con.
  function showTabSwitchToast(label){
    const el = document.createElement('div');
    el.className = 'big-toast';
    el.style.background = '#c99700';
    el.style.top = '80%'; // riêng thông báo này hiện ở khu vực dưới màn hình (80% tính từ trên xuống)
    el.textContent = `Đang ở trong ${label}`;
    document.body.appendChild(el);
    setTimeout(()=>{
      el.classList.add('big-toast-fading');
      setTimeout(()=>{ if(el.parentNode) el.remove(); }, 1200); // khớp đúng thời lượng animation trôi xuống mới (1.2s)
    }, 2000);
  }
  // Thông báo "Đang mở Danh sách ..." — nền vàng đậm, hiện 2 giây rồi tự biến mất, dùng khi mở (bật
  // hiện) bất kỳ panel/danh sách nào trong Sổ vay vốn hoặc Kho lưu trữ.
  function showOpeningListToast(label){
    const el = document.createElement('div');
    el.className = 'big-toast';
    el.style.background = '#c99700';
    el.style.top = '80%'; // riêng thông báo này hiện ở khu vực dưới màn hình (80% tính từ trên xuống), khác vị trí mặc định giữa màn hình của .big-toast
    el.textContent = `Đang mở Danh sách ${label}`;
    document.body.appendChild(el);
    setTimeout(()=>{
      el.classList.add('big-toast-fading');
      setTimeout(()=>{ if(el.parentNode) el.remove(); }, 1200); // khớp đúng thời lượng animation trôi xuống mới (1.2s)
    }, 2000);
  }
  function writeClipboardSilent(text){
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).catch(()=> fallbackCopyText(text));
    } else fallbackCopyText(text);
  }
  function fallbackCopyText(text){
    try{
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      document.execCommand('copy');
      ta.remove();
    }catch(e){ console.warn('Sao chép clipboard lỗi:', e); }
  }
  function copyMessageText(text){ writeClipboardSilent(text); showToast('Đã sao chép!'); }
  // Nối 1 nút "Sao chép" với hiệu ứng phản hồi CHUẨN dùng CHUNG toàn app: bấm vào -> đổi tên thành
  // "Đã sao chép" + nền xanh dương, sau 3 giây tự đổi lại tên "Sao chép" + màu nền bình thường.
  // getText: hàm trả về nội dung cần chép (gọi lại mỗi lần bấm, để luôn lấy giá trị MỚI NHẤT).
  function wireCopyButtonWithFeedback(btn, getText, normalLabel){
    if(!btn) return;
    normalLabel = normalLabel || (btn.textContent||'Sao chép').trim();
    btn.onclick = ()=>{
      writeClipboardSilent(typeof getText==='function' ? getText() : getText);
      if(btn._copyResetTimer) clearTimeout(btn._copyResetTimer);
      btn.textContent = 'Đã sao chép';
      btn.style.background = '#0d47a1';
      btn.style.color = '#fff';
      btn.style.borderColor = '#0d47a1';
      btn._copyResetTimer = setTimeout(()=>{
        btn.textContent = normalLabel;
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
      }, 3000);
    };
  }

  // Dựng HTML "sóng chữ" nhấp nhô liên tục — mỗi ký tự trễ dần 1 chút để tạo hiệu ứng cuộn sóng
  // như đang gõ tin nhắn. Dùng cho "Chàng đang suy nghĩ..." và "AI đang tiêu hoá tài liệu...".
  function waveTextHtml(text){
    // Bọc lượn sóng theo TỪNG TỪ (không phải từng ký tự) — nguyên cả từ nhô lên hạ xuống cùng lúc.
    // Dấu cách được giữ nguyên dạng CHỮ THƯỜNG ở ngoài span (không bọc riêng) để trình duyệt luôn có
    // đúng điểm ngắt dòng tự nhiên tại đó — tránh lặp lại lỗi "mất dấu cách"/"ngắt dòng giữa từ".
    const parts = String(text||'').split(/(\s+)/);
    let wi = 0;
    return `<span class="wave-text">${parts.map(part=>{
      if(/^\s+$/.test(part) || part==='') return escapeHtml(part);
      const html = `<span style="animation-delay:${(wi*0.09).toFixed(3)}s">${escapeHtml(part)}</span>`;
      wi++;
      return html;
    }).join('')}</span>`;
  }
  // Biến thể "THƯA" — chỉ 1-2 từ nhấp nhô CÙNG LÚC (giống 1 con sóng chạy dọc từ đầu tới cuối dòng),
  // thay vì cả dòng nhấp nhô loạn xạ cùng lúc như bản thường — nhưng vẫn giữ NGUYÊN TỐC ĐỘ nhấp nhô
  // của mỗi từ (chỉ giãn khoảng cách delay giữa các từ ra xa hơn, để giảm số từ chồng lấn thời điểm
  // đang nhấp nhô). Dùng riêng cho những dòng chữ dài, không muốn nhìn rối mắt.
  function waveTextHtmlSparse(text){
    const parts = String(text||'').split(/(\s+)/);
    let wi = 0;
    return `<span class="wave-text-sparse">${parts.map(part=>{
      if(/^\s+$/.test(part) || part==='') return escapeHtml(part);
      const html = `<span style="animation-delay:${(wi*0.28).toFixed(3)}s">${escapeHtml(part)}</span>`;
      wi++;
      return html;
    }).join('')}</span>`;
  }
  // Biến thể CHẬM HƠN GẤP ĐÔI — dùng riêng cho tiêu đề các modal lớn (Tính tiền lãi, Tất toán, Gia
  // hạn nợ, Nợ rủi ro, Kho lưu trữ, Chỉnh thời gian hàng quý).
  function waveTextHtmlSlow(text){
    const parts = String(text||'').split(/(\s+)/);
    let wi = 0;
    return `<span class="wave-text-slow">${parts.map(part=>{
      if(/^\s+$/.test(part) || part==='') return escapeHtml(part);
      const html = `<span style="animation-delay:${(wi*0.18).toFixed(3)}s">${escapeHtml(part)}</span>`;
      wi++;
      return html;
    }).join('')}</span>`;
  }

  // Xoá HẲN 1 tin nhắn bất kỳ (của người dùng hoặc AI) khỏi đoạn chat — không thể hoàn tác.
  function deleteMessageAt(idx){
    if(!confirm('Xoá tin nhắn này? Thao tác này KHÔNG THỂ hoàn tác, không thể khôi phục lại. Bạn có chắc chắn?')) return;
    const chat = state.aiChats.find(c=>c.id===state.aiActiveChatId);
    if(!chat || !chat.messages[idx]) return;
    chat.messages.splice(idx, 1);
    chat.updatedAt = new Date().toISOString();
    renderAiChatOverlay();
    saveAiChatToCloud(chat);
  }
  // "Tải lại" — chỉ có ở tin nhắn NGƯỜI DÙNG mới nhất: giữ nguyên câu hỏi, xoá bỏ phản hồi cũ của
  // AI (và mọi thứ sau đó, dù thường không có gì sau tin mới nhất) rồi yêu cầu AI trả lời lại từ đầu.
  async function regenerateReply(idx){
    if(state.aiSending) return;
    const chat = state.aiChats.find(c=>c.id===state.aiActiveChatId);
    if(!chat || !chat.messages[idx]) return;
    chat.messages = chat.messages.slice(0, idx+1);
    await runAssistantTurn(chat, []);
  }
  // Đổi tên 1 đoạn chat theo ý người dùng (ghi đè tên do AI tự đặt, nếu có).
  function renameAiChat(chatId){
    const chat = state.aiChats.find(c=>c.id===chatId);
    if(!chat) return;
    const name = prompt('Đổi tên đoạn chat:', chat.title||'');
    if(name===null || !name.trim()) return;
    chat.title = name.trim().slice(0,60);
    renderAiChatOverlay();
    saveAiChatToCloud(chat);
  }
  // Yêu cầu 7: để AI tự đặt tên ngắn gọn cho đoạn chat dựa trên nội dung trao đổi đầu tiên — gọi
  // riêng 1 lượt AI nhỏ, KHÔNG đưa vào lịch sử hiển thị, không ảnh hưởng luồng chat chính.
  async function generateChatTitle(chat){
    try{
      const firstUser = chat.messages.find(m=>m.role==='user' && !m.streaming);
      const firstAssistant = chat.messages.find(m=>m.role==='assistant' && !m.streaming);
      if(!firstUser || !firstUser.text) return;
      const askText = `Dựa vào đoạn hội thoại sau, hãy đặt 1 tiêu đề thật ngắn gọn (tối đa 6 từ, không quá 40 ký tự, không dùng dấu ngoặc kép, không chấm câu ở cuối, không giải thích gì thêm — CHỈ trả lời đúng tiêu đề) tóm tắt chủ đề chính của đoạn hội thoại:\nNgười dùng: ${firstUser.text.slice(0,300)}\n${firstAssistant && firstAssistant.text? 'Trợ lý: '+firstAssistant.text.slice(0,300) : ''}`;
      const result = await callAIWithFallback([{ role:'user', text: askText }], {}, null);
      const title = (result.text||'').replace(/["'“”‘’\n]/g,'').trim().replace(/[.。]$/,'').slice(0,60);
      if(title){
        chat.title = title;
        if(state._aiChatOpen) renderAiChatOverlay();
        saveAiChatToCloud(chat);
      }
    }catch(e){ console.warn('[AI] Tự đặt tên đoạn chat lỗi (giữ nguyên tên mặc định):', e); }
  }

  // ---------------------------------------------------------------------
  // Sửa & Gửi lại tin nhắn NGƯỜI DÙNG — xoá mọi tin nhắn phía sau (kiểu Gemini) rồi hỏi lại AI.
  // ---------------------------------------------------------------------
  function startEditMessage(idx){ state._aiBubbleEditingIndex = idx; renderAiChatOverlay(); }
  function cancelEditMessage(){ state._aiBubbleEditingIndex = null; renderAiChatOverlay(); }
  async function resendEditedMessage(idx, newText){
    if(!newText || !newText.trim()) return;
    const chat = state.aiChats.find(c=>c.id===state.aiActiveChatId);
    if(!chat) return;
    chat.messages = chat.messages.slice(0, idx); // xoá đúng tin nhắn này và mọi tin nhắn phía sau
    state._aiBubbleEditingIndex = null;
    await sendAiMessage(newText.trim());
  }

  // ---------------------------------------------------------------------
  // "Thêm vào Siêu ghi chú" — đóng Chat AI, mở Siêu ghi chú đúng không gian đã chọn, dán sẵn nội
  // dung tin nhắn vào khung nhập liệu để người dùng xem/sửa rồi tự bấm Gửi.
  // ---------------------------------------------------------------------
  async function addMessageToNotes(idx){
    const chat = state.aiChats.find(c=>c.id===state.aiActiveChatId);
    const msg = chat && chat.messages[idx];
    if(!msg) return;
    const text = msg.text || '';
    writeClipboardSilent(text);
    closeAiChat();
    state._superNotesOpen = true;
    renderSuperNotesOverlay();
    setTimeout(()=>{
      const inputEl = document.getElementById('sn-input');
      if(inputEl){ inputEl.value = text; inputEl.focus(); }
    }, 60);
    showToast('Đã đưa nội dung vào ô nhập của Ghi chú nhanh!');
  }

  // Dựng không gian chat toàn màn hình kiểu Gemini (sidebar lịch sử + khung chat + ô nhập).
  // Gắn TRỰC TIẾP vào document.body (ngoài #root) để không bị render() của app xoá mất.
  function renderAiChatOverlay(){
    let overlay = document.getElementById('ai-chat-overlay');
    let firstCreate = false;
    if(!overlay){
      overlay = document.createElement('div'); overlay.id = 'ai-chat-overlay'; overlay.className = 'ai-overlay';
      document.body.appendChild(overlay);
      firstCreate = true;
    }
    const chat = state.aiChats.find(c=>c.id===state.aiActiveChatId);
    const provider = getActiveAiProvider();
    let lastUserIdx = -1;
    if(chat) chat.messages.forEach((mm,i)=>{ if(mm.role==='user') lastUserIdx = i; });
    // Yêu cầu 6: chỉ tự cuộn xuống đáy nếu người dùng ĐANG ở gần đáy trước khi render lại (đúng
    // hành vi chat bình thường); nếu họ đã cuộn lên xem tin nhắn cũ (vd để bấm Sửa) thì GIỮ
    // NGUYÊN đúng vị trí đang xem, không tự ý kéo họ xuống dưới cùng nữa.
    const prevMsgBox = document.getElementById('ai-messages');
    const wasNearBottom = prevMsgBox ? (prevMsgBox.scrollHeight - prevMsgBox.scrollTop - prevMsgBox.clientHeight < 80) : true;
    const prevScrollTop = prevMsgBox ? prevMsgBox.scrollTop : 0;
    overlay.innerHTML = `
      <div class="ai-sidebar ${state._aiSidebarCollapsed?'collapsed':''}" id="ai-sidebar">
        <button class="ai-exit-btn" id="ai-exit-btn">✕ THOÁT</button>
        <button class="ai-newchat-btn" id="ai-newchat-btn">➕ Đoạn chat mới</button>
        <button class="ai-newchat-btn" id="ai-goto-notes-btn">🗒️ Mở Siêu ghi chú</button>
        <div class="ai-hist-label">Lịch sử đoạn chat</div>
        <div class="ai-hist-list">
          ${state.aiChats.length? state.aiChats.map(c=>`
            <div class="ai-hist-item ${c.id===state.aiActiveChatId?'active':''}" data-ai-hist="${c.id}">
              <span class="ai-hist-title">${escapeHtml(c.title||'Đoạn chat mới')}</span>
              <button class="ai-hist-del" data-ai-hist-rename="${c.id}" title="Đổi tên đoạn chat">✏️</button>
              <button class="ai-hist-del" data-ai-hist-del="${c.id}" title="Xoá đoạn chat">🗑️</button>
            </div>`).join('') : '<div class="sub" style="color:rgba(255,255,255,.6); padding:6px 10px;">Chưa có đoạn chat nào.</div>'}
        </div>
        ${!state.identity || !state.identity.email? '<div class="sub" style="color:rgba(255,255,255,.6); padding:8px 10px; font-size:11px;">Bạn đang dùng khách/tham quan — lịch sử chat chỉ lưu tạm trong phiên này.</div>' : ''}
      </div>
      <button class="ai-sidebar-toggle-btn preview-allow ${state._aiSidebarCollapsed?'collapsed':''}" id="ai-sidebar-toggle-btn" title="${state._aiSidebarCollapsed?'Mở khung lịch sử chat':'Đóng khung lịch sử chat'}">${state._aiSidebarCollapsed?'▶':'◀'}</button>
      <div class="ai-sidebar-scrim ${!state._aiSidebarCollapsed?'show':''}" id="ai-sidebar-scrim"></div>
      <button class="ai-close-fab preview-allow" id="ai-close-fab" title="Đóng Chat AI">✕</button>
      <div class="ai-main ${state._aiSidebarCollapsed?'ai-sidebar-collapsed':''}" id="ai-main-panel">
        <div class="ai-header">🤖 Chàng Nông dân Thông minh</div>
        <div class="ai-messages" id="ai-messages">
          ${!chat || !chat.messages.length? `
            <div class="ai-bubble assistant">Chào bạn! Chàng là "Chàng Nông dân Thông minh" 🌾 — sẵn sàng hỗ trợ nghiệp vụ Hội Nông dân, hướng dẫn sử dụng phần mềm, phân tích số liệu hộ vay, hoặc trò chuyện bất cứ điều gì bạn cần. Bạn muốn hỏi gì nào?</div>`
            : chat.messages.map((m, idx)=>{
                if(m.streaming){
                  return `<div class="ai-bubble assistant ${m.text? '' : 'thinking'}" id="ai-streaming-bubble">${m.text? escapeHtml(m.text) : waveTextHtml('Chàng đang suy nghĩ…')}</div>`;
                }
                if(state._aiBubbleEditingIndex === idx){
                  return `<div class="ai-bubble-wrap ${m.role}">
                    <div class="ai-edit-box">
                      <textarea id="ai-edit-textarea-${idx}" rows="3">${escapeHtml(m.text)}</textarea>
                      <div class="ai-edit-box-actions">
                        <button class="btn btn-ghost btn-sm" data-edit-cancel="${idx}">Huỷ bỏ</button>
                        <button class="btn btn-primary btn-sm" data-edit-resend="${idx}">Gửi lại</button>
                      </div>
                    </div>
                  </div>`;
                }
                const attachHtml = m.attachments && m.attachments.length? `<div class="ai-bubble-attach">${m.attachments.map(a=>`<span class="ai-attach-chip">📎 ${escapeHtml(a.name)}</span>`).join('')}</div>` : '';
                const bodyHtml = m.role==='assistant' ? renderMarkdownLite(m.text) : escapeHtml(m.text);
                const isLastUserMsg = m.role==='user' && idx===lastUserIdx;
                return `<div class="ai-bubble-wrap ${m.role}">
                  <div class="ai-bubble ${m.role}">${bodyHtml}${attachHtml}</div>
                  <div class="ai-bubble-actions">
                    ${m.role==='user'? `<button class="ai-bubble-act" data-bubble-edit="${idx}" title="Sửa">✏️</button>` : ''}
                    ${isLastUserMsg? `<button class="ai-bubble-act" data-bubble-reload="${idx}" title="Tải lại — yêu cầu AI trả lời lại">🔄</button>` : ''}
                    <button class="ai-bubble-act" data-bubble-copy="${idx}" title="Sao chép">📋</button>
                    <button class="ai-bubble-act" data-bubble-addnote="${idx}" title="Thêm vào Ghi chú nhanh">📌</button>
                    <button class="ai-bubble-act" data-bubble-delete="${idx}" title="Xoá tin nhắn này">🗑️</button>
                  </div>
                </div>`;
              }).join('')}
        </div>

        <div class="ai-model-bar">
          <div class="ai-model-select" id="ai-model-select">
            <span>${provider? `🧠 ${escapeHtml(provider.label||provider.model)}` : '⚠️ Chưa cấu hình AI'}</span><span class="ai-model-caret">▾</span>
            ${state._aiModelMenuOpen? `<div class="ai-model-dropdown">
              ${state.aiProviders.length? state.aiProviders.map(p=>`
                <div class="ai-model-opt ${provider&&p.id===provider.id?'active':''}" data-ai-select-provider="${p.id}">
                  ${escapeHtml(p.label||p.model)}<span class="sub">${escapeHtml(p.model)}</span>
                </div>`).join('') : `<div class="ai-model-opt sub">Chưa có cấu hình AI nào — vào "CÀI ĐẶT ADMIN" để thêm.</div>`}
            </div>` : ''}
          </div>
          ${state.aiWebSearchOn? `<span class="ai-model-select" style="background:rgba(199,154,43,.18); margin-left:8px;">🌐 Đang bật Tìm kiếm web</span>` : ''}
        </div>

        ${state.aiPendingAttachments.length? `<div class="ai-attach-row">
          ${state.aiPendingAttachments.map((a,i)=>`<span class="ai-attach-chip">📎 ${escapeHtml(a.name)} <button data-ai-attach-remove="${i}">✕</button></span>`).join('')}
        </div>` : ''}

        <div class="ai-inputbar">
          <div class="ai-add-btn" id="ai-add-btn" role="button" tabindex="0">➕<span class="ai-add-label"> THÊM THÀNH PHẦN</span>
            ${state._aiAddMenuOpen? `<div class="ai-add-menu">
              <div class="ai-add-opt" data-ai-add="image">🖼️ Tải ảnh lên</div>
              <div class="ai-add-opt" data-ai-add="doc">📄 Tải tài liệu lên</div>
              <div class="ai-add-opt${state._aiMic2Listening?' ai-add-opt-disabled':''}" data-ai-add="mic">🎤 ${state._aiMicListening? '✅ Đang nghe — bấm để dừng' : 'Vừa nói vừa ra chữ'}</div>
              <div class="ai-add-opt${state._aiMicListening?' ai-add-opt-disabled':''}" data-ai-add="mic2">🎙️ ${state._aiMic2Listening? '✅ Đang nghe — bấm để dừng' : 'Nói xong mới ra chữ'}</div>
              <div class="ai-add-opt" data-ai-add="websearch">🌐 ${state.aiWebSearchOn? '✅ Đang bật — bấm để tắt' : 'Tìm kiếm web'}</div>
            </div>` : ''}
          </div>
          <textarea id="ai-input" rows="1" placeholder="Nhắn tin cho Chàng Nông dân Thông minh... (Enter để xuống dòng, Ctrl+Enter để gửi)"></textarea>
          <div class="ai-send-wrap">
            <span class="ai-send-tooltip">${state.aiSending? 'Chỉ bấm nút để dừng — Enter sẽ không có tác dụng' : 'Bấm Ctrl+Enter để gửi nhanh'}</span>
            ${state.aiSending? `<button id="ai-stop-btn" class="ai-stop-btn" title="Dừng câu trả lời">⏹</button>` : `<button id="ai-send-btn">➤</button>`}
          </div>
        </div>
      </div>`;
    const msgBox = document.getElementById('ai-messages');
    if(msgBox) msgBox.scrollTop = wasNearBottom ? msgBox.scrollHeight : prevScrollTop;
    wireMarkdownExtras(overlay);
    document.getElementById('ai-exit-btn').onclick = closeAiChat;
    const aiCloseFab = document.getElementById('ai-close-fab');
    if(aiCloseFab) aiCloseFab.onclick = closeAiChat;
    document.getElementById('ai-newchat-btn').onclick = newAiChat;
    // Đóng/mở khung "Lịch sử đoạn chat" — hiệu ứng y hệt sidebar menu chính của toàn app.
    // QUAN TRỌNG: sau khi vẽ lại do đóng/mở, CHỦ ĐỘNG bỏ focus khỏi khung nhập chat (nếu có) — đảm bảo
    // KHÔNG BAO GIỜ tự động hiện con trỏ văn bản ở đó, chỉ khi người dùng TỰ bấm vào khung chat thì mới
    // có con trỏ để nhập liệu, đúng yêu cầu.
    const blurAiInputIfAny = ()=>{ const inp = document.getElementById('ai-input'); if(inp && document.activeElement===inp) inp.blur(); };
    const aiSidebarToggleBtn = document.getElementById('ai-sidebar-toggle-btn');
    if(aiSidebarToggleBtn) aiSidebarToggleBtn.onclick = (e)=>{
      e.stopPropagation();
      state._aiSidebarCollapsed = !state._aiSidebarCollapsed;
      renderAiChatOverlay();
      requestAnimationFrame(blurAiInputIfAny);
    };
    // Màn hình hẹp: mặc định LUÔN mở sẵn khung lịch sử chat, khoá thao tác ở màn hình bên phải — bấm
    // vào lớp phủ mờ HOẶC bấm vào bất kỳ đâu trong khung thao tác bên phải đều chỉ có đúng 1 kết quả là
    // ĐÓNG khung lịch sử chat lại (không thực hiện thêm hành động nào khác ở lần bấm đó).
    const aiSidebarScrim = document.getElementById('ai-sidebar-scrim');
    if(aiSidebarScrim) aiSidebarScrim.onclick = ()=>{ state._aiSidebarCollapsed = true; renderAiChatOverlay(); requestAnimationFrame(blurAiInputIfAny); };
    const aiMainPanel = document.getElementById('ai-main-panel');
    if(aiMainPanel) aiMainPanel.addEventListener('click', (e)=>{
      if(!isNarrowScreenForSidebar()) return;
      if(state._aiSidebarCollapsed) return; // đã đóng sẵn rồi thì thao tác bình thường, không chặn gì cả
      e.preventDefault();
      e.stopPropagation();
      state._aiSidebarCollapsed = true;
      renderAiChatOverlay();
      requestAnimationFrame(blurAiInputIfAny);
    }, true); // bắt ở giai đoạn CAPTURE — chặn TRƯỚC khi bất kỳ nút/thao tác nào khác bên trong kịp xử lý, đúng yêu cầu "chỉ có đúng 1 kết quả duy nhất là đóng khung"
    const gotoNotesBtn = document.getElementById('ai-goto-notes-btn');
    if(gotoNotesBtn) gotoNotesBtn.onclick = ()=>{ closeAiChat(); openSuperNotes(); };
    overlay.querySelectorAll('[data-ai-hist]').forEach(elx=>{
      elx.addEventListener('click', (e)=>{
        if(e.target.closest('[data-ai-hist-del]')) return;
        state.aiActiveChatId = elx.dataset.aiHist;
        renderAiChatOverlay();
      });
    });
    overlay.querySelectorAll('[data-ai-hist-del]').forEach(btn=>{
      btn.onclick = (e)=>{ e.stopPropagation(); deleteAiChatById(btn.dataset.aiHistDel); };
    });
    overlay.querySelectorAll('[data-ai-hist-rename]').forEach(btn=>{
      btn.onclick = (e)=>{ e.stopPropagation(); renameAiChat(btn.dataset.aiHistRename); };
    });

    // ---- Icon hành động trên bong bóng tin nhắn: Sửa / Tải lại / Copy / Thêm vào Siêu ghi chú / Xoá ----
    overlay.querySelectorAll('[data-bubble-edit]').forEach(btn=>{
      btn.onclick = ()=> startEditMessage(parseInt(btn.dataset.bubbleEdit,10));
    });
    overlay.querySelectorAll('[data-bubble-reload]').forEach(btn=>{
      btn.onclick = ()=> regenerateReply(parseInt(btn.dataset.bubbleReload,10));
    });
    overlay.querySelectorAll('[data-bubble-copy]').forEach(btn=>{
      btn.onclick = ()=>{
        const idx = parseInt(btn.dataset.bubbleCopy,10);
        const m = chat && chat.messages[idx];
        if(m) copyMessageText(m.text||'');
      };
    });
    overlay.querySelectorAll('[data-bubble-delete]').forEach(btn=>{
      btn.onclick = ()=> deleteMessageAt(parseInt(btn.dataset.bubbleDelete,10));
    });
    overlay.querySelectorAll('[data-bubble-addnote]').forEach(btn=>{
      // Ghi chú nhanh chỉ còn một nơi lưu (Trung tâm dữ liệu, Bộ cá nhân) nên không cần
      // menu chọn Bộ chung/Bộ cá nhân nữa — bấm là đưa thẳng nội dung sang ô nhập.
      btn.onclick = (e)=>{ e.stopPropagation(); addMessageToNotes(parseInt(btn.dataset.bubbleAddnote,10)); };
    });
    overlay.querySelectorAll('[data-edit-cancel]').forEach(btn=> btn.onclick = cancelEditMessage);
    overlay.querySelectorAll('[data-edit-resend]').forEach(btn=>{
      btn.onclick = ()=>{
        const idx = parseInt(btn.dataset.editResend,10);
        const ta = document.getElementById(`ai-edit-textarea-${idx}`);
        resendEditedMessage(idx, ta? ta.value : '');
      };
    });

    // ---- Thanh chọn model AI đang hoạt động ----
    const modelSelectEl = document.getElementById('ai-model-select');
    if(modelSelectEl) modelSelectEl.addEventListener('click', (e)=>{ e.stopPropagation(); toggleAiModelMenu(); });
    overlay.querySelectorAll('[data-ai-select-provider]').forEach(elx=>{
      elx.addEventListener('click', (e)=>{ e.stopPropagation(); selectAiProvider(elx.dataset.aiSelectProvider); });
    });

    // ---- Nút "THÊM THÀNH PHẦN" ----
    const addBtn = document.getElementById('ai-add-btn');
    if(addBtn){
      addBtn.addEventListener('click', (e)=>{ e.stopPropagation(); toggleAiAddMenu(); });
      addBtn.addEventListener('keydown', (e)=>{ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); e.stopPropagation(); toggleAiAddMenu(); } });
    }
    overlay.querySelectorAll('[data-ai-add]').forEach(elx=>{
      elx.addEventListener('click', (e)=>{
        e.stopPropagation();
        const kind = elx.dataset.aiAdd;
        // Khi 1 trong 2 nút micro đang hoạt động (đang thu âm), nút micro CÒN LẠI bị khoá hẳn — không
        // cho bấm vào cho tới khi nút đang hoạt động dừng lại (dừng hẳn hoặc bị huỷ).
        if(kind==='mic' && (state._aiMic2Listening || state._aiMic2Processing)) return;
        if(kind==='mic2' && state._aiMicListening) return;
        if(kind==='websearch') toggleAiWebSearch();
        else if(kind==='mic' || kind==='mic2'){
          // Đóng NGAY menu thả xuống bằng thao tác DOM trực tiếp — KHÔNG được gọi vẽ lại toàn bộ khung
          // chat ở đây (2 hàm mic bên dưới không cho phép việc đó, sẽ làm mất chữ đang gõ dở trong ô
          // nhập). Chỉ còn lại đúng bảng trạng thái nhỏ (do chính 2 hàm mic tự hiện lên) là hiển thị.
          state._aiAddMenuOpen = false;
          const menuEl = document.querySelector('#ai-add-btn .ai-add-menu');
          if(menuEl) menuEl.remove();
          if(kind==='mic') toggleAiMic(); else toggleAiRecordThenTranscribe();
        }
        else triggerAiFileInput(kind);
      });
    });
    overlay.querySelectorAll('[data-ai-attach-remove]').forEach(btn=>{
      btn.onclick = (e)=>{ e.stopPropagation(); removeAiAttachment(parseInt(btn.dataset.aiAttachRemove,10)); };
    });

    // Bấm ra ngoài thì tự đóng các dropdown (chỉ gắn listener DUY NHẤT 1 lần lúc tạo overlay,
    // tránh chồng chất listener qua mỗi lần render lại).
    if(firstCreate){
      aiOutsideClickHandler = ()=>{
        if(state._aiModelMenuOpen || state._aiAddMenuOpen){
          state._aiModelMenuOpen = false; state._aiAddMenuOpen = false;
          if(document.getElementById('ai-chat-overlay')){
            const inputEl = document.getElementById('ai-input');
            const savedValue = inputEl ? inputEl.value : '';
            renderAiChatOverlay();
            const inputElAfter = document.getElementById('ai-input');
            if(inputElAfter && savedValue) inputElAfter.value = savedValue;
            if(inputElAfter) autoResizeTextarea(inputElAfter);
          }
        }
      };
      document.addEventListener('click', aiOutsideClickHandler);
    }

    const sendBtn = document.getElementById('ai-send-btn');
    const stopBtn = document.getElementById('ai-stop-btn');
    if(stopBtn) stopBtn.onclick = ()=>{ if(state.aiAbortController) state.aiAbortController.abort(); };
    const inputEl = document.getElementById('ai-input');
    const doSend = ()=>{
      if(state.aiSending) return; // đang trả lời -> Enter không có tác dụng, chỉ nút Dừng mới dừng được
      const v = inputEl.value; inputEl.value='';
      sendAiMessage(v);
    };
    if(sendBtn) sendBtn.onclick = doSend;
    wireAutoResizeTextarea('ai-input');
    if(inputEl){
      // Không tự động focus — đồng bộ với các module AI khác (Siêu ghi chú/Tuyên truyền/Thêm nhanh
      // bằng AI): mặc định KHÔNG có con trỏ văn bản, chỉ khi người dùng TỰ bấm vào khung chat mới có
      // con trỏ để nhập. (Trước đây dòng focus() gắn cứng ở đây chạy lại MỖI LẦN vẽ lại toàn bộ khung
      // chat — kể cả khi chỉ bấm nút "Thêm thành phần" cũng kích hoạt vẽ lại — khiến con trỏ tự xuất
      // hiện ngoài ý muốn, đây là lỗi thật đã xảy ra, nay xoá hẳn dòng gây lỗi.)
      // Yêu cầu 5: Enter thường = xuống dòng (mặc định của textarea, không preventDefault);
      // Ctrl+Enter (hoặc Cmd+Enter trên Mac) = gửi tin nhắn ngay.
      inputEl.addEventListener('keydown', (e)=>{
        if(e.key==='Enter' && (e.ctrlKey || e.metaKey)){ e.preventDefault(); doSend(); }
      });
    }
  }

