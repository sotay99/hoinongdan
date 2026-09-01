"use strict";

// Logic DÙNG CHUNG cho build-static.js và validate-static.js: trích đúng 2 khối
// token (:root và .dark) từ bảng màu của Hội Nông dân Web Design System.
// Đặt ở một nơi duy nhất để bản build và bản kiểm tra KHÔNG BAO GIỜ lệch nhau —
// trước đây mỗi script tự hiểu một kiểu nên validate-static.js đã lạc hậu so với
// build-static.js mà không ai phát hiện.

function extractDesignSystemTheme(source) {
  const css = source.toString("utf8");
  const light = css.match(/^\s*:root\s*\{[\s\S]*?^\s*\}/m)?.[0];
  const dark = css.match(/^\s*\.dark\s*\{[\s\S]*?^\s*\}/m)?.[0];
  if (!light || !dark) return null;
  return Buffer.from(
    "/* Generated from @workspace/hoi-nong-dan-web; do not edit this output. */\n\n" +
      light.trim() +
      "\n\n" +
      dark.trim() +
      "\n",
    "utf8",
  );
}

module.exports = { extractDesignSystemTheme };
