/* PlayFeed 後台設定
   還沒設定時網站照樣能玩（體驗模式），按讚、留言、儲存不會被記錄。
   照「開始指南.md」開好 Supabase 和 Phuze 之後，把下面三個值換成你自己的：
*/
window.PLAYFEED_CONFIG = {
  SUPABASE_URL: "https://oimdeoszgxfumwtmapok.supabase.co",           // 例如 "https://abcdefgh.supabase.co"
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pbWRlb3N6Z3hmdW13dG1hcG9rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1NDA2MzksImV4cCI6MjEwMDExNjYzOX0.ZK7efiPZBNwgksDjyJbqjw5VfU_WnDEYf_fxiynCnw8",      // Supabase 後台 Settings → API 裡那串很長的 anon public key
  PHUZE_PUBLISHABLE_KEY: "pk_live_lH_HdLaGiCyidHDFxwS7SuQnXMlRr0kz"   // Phuze 註冊後拿到的 pk_live_ 開頭的 key（會員登入用）
};
