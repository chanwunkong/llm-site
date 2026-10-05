// 日本語範例資料：依《小王子》劇情自行改寫的簡易版本（非原文或現有譯本）。
// 詞元與 UD 詞性為人工標註。
import tebukuro from './sources/ja-tebukuro.js';
import chumon from './sources/ja-chumon.js';

export default {
  id: 'ja',
  name: '日本語',
  bcp47: 'ja-JP',
  wals: 'jpn',
  joiner: '',
  sources: [
    tebukuro,
    chumon,
    {
      id: 'ja-prince', kind: '故事', title: '星の王子さま（改寫版）',
      situations: [
        {
          title: '砂漠のパイロット', sentences: [
            'パイロット|NOUN が|ADP 砂漠|NOUN の|ADP 上|NOUN で|ADP 小さい|ADJ 飛行機|NOUN を|ADP 飛ばす|VERB 。|PUNCT',
            '飛行機|NOUN が|ADP 壊れ|VERB|壊れる て|SCONJ 、|PUNCT パイロット|NOUN は|ADP 砂|NOUN の|ADP 上|NOUN に|ADP 落ちる|VERB 。|PUNCT',
            '水|NOUN が|ADP 少し|ADV しか|ADP ない|ADJ|ない|Polarity=Neg 。|PUNCT',
            '朝|NOUN 、|PUNCT 小さい|ADJ 声|NOUN が|ADP パイロット|NOUN を|ADP 起こす|VERB 。|PUNCT',
            '砂|NOUN の|ADP 上|NOUN に|ADP 小さい|ADJ 王子|NOUN が|ADP 立っ|VERB|立つ て|SCONJ いる|AUX 。|PUNCT',
            '王子|NOUN は|ADP 羊|NOUN の|ADP 絵|NOUN を|ADP 頼む|VERB 。|PUNCT',
            'パイロット|NOUN は|ADP 羊|NOUN の|ADP 絵|NOUN を|ADP 描く|VERB 。|PUNCT',
            '王子|NOUN は|ADP その|DET|その|PronType=Dem 絵|NOUN が|ADP 嫌い|ADJ だ|AUX 。|PUNCT',
            'パイロット|NOUN は|ADP 箱|NOUN の|ADP 絵|NOUN を|ADP 描く|VERB 。|PUNCT',
            '羊|NOUN は|ADP 箱|NOUN の|ADP 中|NOUN で|ADP 寝る|VERB 。|PUNCT',
            '王子|NOUN は|ADP 箱|NOUN を|ADP 見|VERB|見る て|SCONJ 笑う|VERB 。|PUNCT',
            '王子|NOUN は|ADP とても|ADV 小さい|ADJ 星|NOUN から|ADP 来る|VERB 。|PUNCT',
          ],
        },
        {
          title: '星とバラ', sentences: [
            '王子|NOUN は|ADP 毎朝|NOUN 小さい|ADJ 星|NOUN を|ADP 掃除|NOUN する|AUX 。|PUNCT',
            '王子|NOUN は|ADP 小さい|ADJ 火山|NOUN を|ADP 掃除|NOUN する|AUX 。|PUNCT',
            'バオバブ|NOUN は|ADP 大きい|ADJ 木|NOUN だ|AUX 。|PUNCT',
            '羊|NOUN は|ADP 小さい|ADJ 木|NOUN を|ADP 食べる|VERB 。|PUNCT',
            '王子|NOUN は|ADP 夕日|NOUN が|ADP 好き|ADJ だ|AUX 。|PUNCT',
            '悲しい|ADJ 時|NOUN 、|PUNCT 王子|NOUN は|ADP 夕日|NOUN を|ADP 見る|VERB 。|PUNCT',
            'ある|DET 日|NOUN 、|PUNCT 星|NOUN に|ADP 赤い|ADJ バラ|NOUN が|ADP 咲く|VERB 。|PUNCT',
            'バラ|NOUN は|ADP とても|ADV きれい|ADJ だ|AUX 。|PUNCT',
            '王子|NOUN は|ADP 毎朝|NOUN バラ|NOUN に|ADP 水|NOUN を|ADP あげる|VERB 。|PUNCT',
            '夜|NOUN 、|PUNCT 王子|NOUN は|ADP バラ|NOUN に|ADP ガラス|NOUN の|ADP 覆い|NOUN を|ADP かける|VERB 。|PUNCT',
            '王子|NOUN は|ADP バラ|NOUN が|ADP 好き|ADJ だ|AUX 。|PUNCT',
            'でも|CCONJ 、|PUNCT 王子|NOUN は|ADP 星|NOUN を|ADP 出る|VERB 。|PUNCT',
          ],
        },
      ],
    },
  ],
};
