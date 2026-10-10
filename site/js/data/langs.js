// 可學習的 21 種語言：介面名稱、WALS 代碼、語音代碼、書寫方式與匯入時用的斷句標註工具。
// tagger：udpipe = UDPipe 線上服務（UD 模型，CC BY-NC-SA，限非商業使用）；kuromoji = 瀏覽器內的日文斷詞；
//         basic = 沒有 UD 模型，只用瀏覽器內建的斷詞（沒有詞性，規則不啟動）
// joiner：字與字之間的分隔（中文、日文、泰文不空格）；dir：書寫方向
export const LANG_LIST = [
  { id: 'en', name: 'English', zh: '英語', wals: 'eng', bcp47: 'en-US', joiner: ' ', tagger: 'udpipe', model: 'english' },
  { id: 'de', name: 'Deutsch', zh: '德語', wals: 'ger', bcp47: 'de-DE', joiner: ' ', tagger: 'udpipe', model: 'german' },
  { id: 'es', name: 'Español', zh: '西班牙語', wals: 'spa', bcp47: 'es-ES', joiner: ' ', tagger: 'udpipe', model: 'spanish' },
  { id: 'pt', name: 'Português', zh: '葡萄牙語', wals: 'por', bcp47: 'pt-BR', joiner: ' ', tagger: 'udpipe', model: 'portuguese' },
  { id: 'fr', name: 'Français', zh: '法語', wals: 'fre', bcp47: 'fr-FR', joiner: ' ', tagger: 'udpipe', model: 'french' },
  { id: 'it', name: 'Italiano', zh: '義大利語', wals: 'ita', bcp47: 'it-IT', joiner: ' ', tagger: 'udpipe', model: 'italian' },
  { id: 'ru', name: 'Русский', zh: '俄語', wals: 'rus', bcp47: 'ru-RU', joiner: ' ', tagger: 'udpipe', model: 'russian' },
  { id: 'bn', name: 'বাংলা', zh: '孟加拉語', wals: 'ben', bcp47: 'bn-IN', joiner: ' ', tagger: 'basic' },
  { id: 'hi', name: 'हिन्दी', zh: '印地語', wals: 'hin', bcp47: 'hi-IN', joiner: ' ', tagger: 'udpipe', model: 'hindi' },
  { id: 'fa', name: 'فارسی', zh: '波斯語', wals: 'prs', bcp47: 'fa-IR', joiner: ' ', dir: 'rtl', tagger: 'udpipe', model: 'persian' },
  { id: 'ar', name: 'العربية', zh: '阿拉伯語', wals: 'ams', bcp47: 'ar-SA', joiner: ' ', dir: 'rtl', tagger: 'udpipe', model: 'arabic' },
  { id: 'ta', name: 'தமிழ்', zh: '坦米爾語', wals: 'tml', bcp47: 'ta-IN', joiner: ' ', tagger: 'udpipe', model: 'tamil' },
  { id: 'zh', name: '中文', zh: '中文', wals: 'mnd', bcp47: 'zh-TW', joiner: '', tagger: 'udpipe', model: 'chinese-gsd' },
  { id: 'tr', name: 'Türkçe', zh: '土耳其語', wals: 'tur', bcp47: 'tr-TR', joiner: ' ', tagger: 'udpipe', model: 'turkish' },
  { id: 'ja', name: '日本語', zh: '日語', wals: 'jpn', bcp47: 'ja-JP', joiner: '', tagger: 'kuromoji' },
  { id: 'ko', name: '한국어', zh: '韓語', wals: 'kor', bcp47: 'ko-KR', joiner: ' ', tagger: 'udpipe', model: 'korean' },
  { id: 'vi', name: 'Tiếng Việt', zh: '越南語', wals: 'vie', bcp47: 'vi-VN', joiner: ' ', tagger: 'udpipe', model: 'vietnamese' },
  { id: 'id', name: 'Bahasa Indonesia', zh: '印尼語', wals: 'ind', bcp47: 'id-ID', joiner: ' ', tagger: 'udpipe', model: 'indonesian' },
  { id: 'th', name: 'ไทย', zh: '泰語', wals: 'tha', bcp47: 'th-TH', joiner: '', tagger: 'udpipe', model: 'thai', weak: true },
  { id: 'sw', name: 'Kiswahili', zh: '史瓦希里語', wals: 'swa', bcp47: 'sw-KE', joiner: ' ', tagger: 'basic' },
  { id: 'ky', name: 'Кыргызча', zh: '吉爾吉斯語', wals: 'kgz', bcp47: 'ky-KG', joiner: ' ', tagger: 'udpipe', model: 'kyrgyz' },
];
export const LANG_BY_ID = Object.fromEntries(LANG_LIST.map(l => [l.id, l]));
