// 可學習的 21 種語言：介面名稱、WALS 代碼、語音代碼、書寫方式與匯入時用的斷句標註工具。
// tagger：udpipe = UDPipe 線上服務（UD 模型，CC BY-NC-SA，限非商業使用）；kuromoji = 瀏覽器內的日文斷詞；
//         basic = 沒有 UD 模型，只用瀏覽器內建的斷詞（沒有詞性，規則不啟動）
// joiner：字與字之間的分隔（中文、日文、泰文不空格）；dir：書寫方向；espeak：手機沒有語音時，在手機上用 eSpeak NG 朗讀的語音代碼；
// piper：手機沒有語音時優先使用的 Piper 聲音（rhasspy/piper-voices，第一次使用時下載 piperMB MB）
export const LANG_LIST = [
  { id: 'en', name: 'English', zh: '英語', wals: 'eng', bcp47: 'en-US', joiner: ' ', tagger: 'udpipe', model: 'english', espeak: 'en-us', piper: 'en_US-lessac-medium', piperMB: 60 },
  { id: 'de', name: 'Deutsch', zh: '德語', wals: 'ger', bcp47: 'de-DE', joiner: ' ', tagger: 'udpipe', model: 'german', espeak: 'de', piper: 'de_DE-thorsten-medium', piperMB: 60 },
  { id: 'es', name: 'Español', zh: '西班牙語', wals: 'spa', bcp47: 'es-ES', joiner: ' ', tagger: 'udpipe', model: 'spanish', espeak: 'es', piper: 'es_ES-davefx-medium', piperMB: 60 },
  { id: 'pt', name: 'Português', zh: '葡萄牙語', wals: 'por', bcp47: 'pt-BR', joiner: ' ', tagger: 'udpipe', model: 'portuguese', espeak: 'pt-br', piper: 'pt_BR-faber-medium', piperMB: 60 },
  { id: 'fr', name: 'Français', zh: '法語', wals: 'fre', bcp47: 'fr-FR', joiner: ' ', tagger: 'udpipe', model: 'french', espeak: 'fr-fr', piper: 'fr_FR-siwis-medium', piperMB: 60 },
  { id: 'it', name: 'Italiano', zh: '義大利語', wals: 'ita', bcp47: 'it-IT', joiner: ' ', tagger: 'udpipe', model: 'italian', espeak: 'it', piper: 'it_IT-paola-medium', piperMB: 60 },
  { id: 'ru', name: 'Русский', zh: '俄語', wals: 'rus', bcp47: 'ru-RU', joiner: ' ', tagger: 'udpipe', model: 'russian', espeak: 'ru', piper: 'ru_RU-irina-medium', piperMB: 60 },
  { id: 'bn', name: 'বাংলা', zh: '孟加拉語', wals: 'ben', bcp47: 'bn-IN', joiner: ' ', tagger: 'basic', espeak: 'bn', piper: 'bn_BD-google-medium', piperMB: 73 },
  { id: 'hi', name: 'हिन्दी', zh: '印地語', wals: 'hin', bcp47: 'hi-IN', joiner: ' ', tagger: 'udpipe', model: 'hindi', espeak: 'hi', piper: 'hi_IN-rohan-medium', piperMB: 60 },
  { id: 'fa', name: 'فارسی', zh: '波斯語', wals: 'prs', bcp47: 'fa-IR', joiner: ' ', dir: 'rtl', tagger: 'udpipe', model: 'persian', espeak: 'fa', piper: 'fa_IR-gyro-medium', piperMB: 60 },
  { id: 'ar', name: 'العربية', zh: '阿拉伯語', wals: 'ams', bcp47: 'ar-SA', joiner: ' ', dir: 'rtl', tagger: 'udpipe', model: 'arabic', espeak: 'ar', piper: 'ar_JO-kareem-medium', piperMB: 60 },
  { id: 'ta', name: 'தமிழ்', zh: '坦米爾語', wals: 'tml', bcp47: 'ta-IN', joiner: ' ', tagger: 'udpipe', model: 'tamil', espeak: 'ta' },
  { id: 'zh', name: '中文', zh: '中文', wals: 'mnd', bcp47: 'zh-TW', joiner: '', tagger: 'udpipe', model: 'chinese-gsd', espeak: 'cmn', piper: 'zh_CN-huayan-medium', piperMB: 60 },
  { id: 'tr', name: 'Türkçe', zh: '土耳其語', wals: 'tur', bcp47: 'tr-TR', joiner: ' ', tagger: 'udpipe', model: 'turkish', espeak: 'tr', piper: 'tr_TR-dfki-medium', piperMB: 60 },
  { id: 'ja', name: '日本語', zh: '日語', wals: 'jpn', bcp47: 'ja-JP', joiner: '', tagger: 'kuromoji', espeak: 'ja' },
  { id: 'ko', name: '한국어', zh: '韓語', wals: 'kor', bcp47: 'ko-KR', joiner: ' ', tagger: 'udpipe', model: 'korean', espeak: 'ko', piper: 'ko_KR-kss-medium', piperMB: 60 },
  { id: 'vi', name: 'Tiếng Việt', zh: '越南語', wals: 'vie', bcp47: 'vi-VN', joiner: ' ', tagger: 'udpipe', model: 'vietnamese', espeak: 'vi', piper: 'vi_VN-vais1000-medium', piperMB: 60 },
  { id: 'id', name: 'Bahasa Indonesia', zh: '印尼語', wals: 'ind', bcp47: 'id-ID', joiner: ' ', tagger: 'udpipe', model: 'indonesian', espeak: 'id', piper: 'id_ID-news_tts-medium', piperMB: 60 },
  { id: 'th', name: 'ไทย', zh: '泰語', wals: 'tha', bcp47: 'th-TH', joiner: '', tagger: 'udpipe', model: 'thai', weak: true, espeak: 'th' },
  { id: 'sw', name: 'Kiswahili', zh: '史瓦希里語', wals: 'swa', bcp47: 'sw-KE', joiner: ' ', tagger: 'basic', espeak: 'sw', piper: 'sw_CD-lanfrica-medium', piperMB: 60 },
  { id: 'ky', name: 'Кыргызча', zh: '吉爾吉斯語', wals: 'kgz', bcp47: 'ky-KG', joiner: ' ', tagger: 'udpipe', model: 'kyrgyz', espeak: 'ky' },
];
export const LANG_BY_ID = Object.fromEntries(LANG_LIST.map(l => [l.id, l]));
