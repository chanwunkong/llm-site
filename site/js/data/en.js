// 英文範例資料：依《小王子》劇情自行改寫的簡易版本（非原文或現有譯本）。
// 詞元與 UD 詞性為人工標註，模擬匯入時標記工具的輸出。
// 句子格式：「寫法|UPOS|詞元|特徵」，詞元省略時 = 寫法轉小寫。
export default {
  id: 'en',
  name: 'English',
  bcp47: 'en-US',
  wals: 'eng',
  joiner: ' ',
  base: {
    prince: '🤴', pilot: '🧑‍✈️', airplane: '✈️', desert: '🏜️', water: '💧', sheep: '🐑', box: '📦',
    planet: '🪐', house: '🏠', volcano: '🌋', tree: '🌳', sunset: '🌇', sun: '☀️', star: '⭐',
    flower: '🌸', rose: '🌹', wind: '🌬️', bird: '🐦', fox: '🦊', heart: '❤️', eye: '👁️',
    morning: '🌅', night: '🌙', draw: '✏️', sleep: '😴', smile: '😊', eat: '🍽️', fly: '🕊️',
    red: '🟥', sad: '😢', cold: '🥶', old: '👴', small: '🤏', secret: '🤫', earth: '🌍',
  },
  sources: [
    {
      id: 'en-prince', kind: '故事', title: 'The Little Prince（改寫版）',
      situations: [
        {
          title: '沙漠裡的飛行員', sentences: [
            'A|DET|a pilot|NOUN flies|VERB|fly a|DET small|ADJ airplane|NOUN over|ADP the|DET desert|NOUN .|PUNCT',
            'The|DET|the airplane|NOUN breaks|VERB|break ,|PUNCT and|CCONJ the|DET pilot|NOUN falls|VERB|fall into|ADP the|DET sand|NOUN .|PUNCT',
            'He|PRON|he is|AUX|be alone|ADJ ,|PUNCT and|CCONJ he|PRON has|VERB|have little|ADJ water|NOUN .|PUNCT',
            'In|ADP|in the|DET morning|NOUN ,|PUNCT a|DET small|ADJ voice|NOUN wakes|VERB|wake him|PRON|he .|PUNCT',
            'A|DET|a little|ADJ prince|NOUN stands|VERB|stand in|ADP the|DET sand|NOUN .|PUNCT',
            'The|DET|the prince|NOUN asks|VERB|ask the|DET pilot|NOUN to|PART draw|VERB a|DET sheep|NOUN .|PUNCT',
            'The|DET|the pilot|NOUN draws|VERB|draw a|DET sheep|NOUN ,|PUNCT but|CCONJ the|DET prince|NOUN does|AUX|do not|PART like|VERB it|PRON .|PUNCT',
            'The|DET|the second|ADJ sheep|NOUN is|AUX|be too|ADV old|ADJ .|PUNCT',
            'Then|ADV|then the|DET pilot|NOUN draws|VERB|draw a|DET box|NOUN .|PUNCT',
            'The|DET|the pilot|NOUN says|VERB|say that|SCONJ the|DET sheep|NOUN sleeps|VERB|sleep in|ADP the|DET box|NOUN .|PUNCT',
            'The|DET|the prince|NOUN looks|VERB|look at|ADP the|DET box|NOUN and|CCONJ smiles|VERB|smile .|PUNCT',
            'The|DET|the prince|NOUN comes|VERB|come from|ADP a|DET very|ADV small|ADJ planet|NOUN .|PUNCT',
            'His|PRON|he planet|NOUN is|AUX|be as|ADV small|ADJ as|ADP a|DET house|NOUN .|PUNCT',
          ],
        },
        {
          title: '小小的星球', sentences: [
            'Every|DET|every morning|NOUN ,|PUNCT the|DET prince|NOUN cleans|VERB|clean his|PRON|he small|ADJ planet|NOUN .|PUNCT',
            'He|PRON|he cleans|VERB|clean three|NUM small|ADJ volcanoes|NOUN|volcano|Number=Plur .|PUNCT',
            'He|PRON|he pulls|VERB|pull young|ADJ baobabs|NOUN|baobab|Number=Plur from|ADP the|DET ground|NOUN .|PUNCT',
            'Big|ADJ|big baobabs|NOUN|baobab|Number=Plur can|AUX break|VERB a|DET small|ADJ planet|NOUN .|PUNCT',
            'A|DET|a sheep|NOUN eats|VERB|eat small|ADJ trees|NOUN|tree|Number=Plur ,|PUNCT so|CCONJ the|DET prince|NOUN wants|VERB|want a|DET sheep|NOUN .|PUNCT',
            'The|DET|the prince|NOUN likes|VERB|like the|DET sunset|NOUN very|ADV much|ADV .|PUNCT',
            'When|SCONJ|when he|PRON is|AUX|be sad|ADJ ,|PUNCT he|PRON watches|VERB|watch the|DET sunset|NOUN .|PUNCT',
            'The|DET|the sun|NOUN goes|VERB|go down|ADV ,|PUNCT and|CCONJ the|DET sky|NOUN turns|VERB|turn red|ADJ .|PUNCT',
            'The|DET|the prince|NOUN sits|VERB|sit alone|ADV and|CCONJ looks|VERB|look at|ADP the|DET stars|NOUN|star|Number=Plur .|PUNCT',
          ],
        },
        {
          title: '玫瑰', sentences: [
            'One|NUM|one day|NOUN ,|PUNCT a|DET new|ADJ flower|NOUN grows|VERB|grow on|ADP the|DET planet|NOUN .|PUNCT',
            'The|DET|the flower|NOUN is|AUX|be a|DET beautiful|ADJ red|ADJ rose|NOUN .|PUNCT',
            'The|DET|the rose|NOUN is|AUX|be proud|ADJ ,|PUNCT and|CCONJ she|PRON asks|VERB|ask for|ADP water|NOUN .|PUNCT',
            'The|DET|the prince|NOUN gives|VERB|give the|DET rose|NOUN fresh|ADJ water|NOUN every|DET morning|NOUN .|PUNCT',
            'At|ADP|at night|NOUN ,|PUNCT he|PRON puts|VERB|put a|DET glass|NOUN cover|NOUN on|ADP the|DET rose|NOUN .|PUNCT',
            'The|DET|the rose|NOUN says|VERB|say that|SCONJ the|DET wind|NOUN is|AUX|be cold|ADJ .|PUNCT',
            'The|DET|the prince|NOUN loves|VERB|love the|DET rose|NOUN ,|PUNCT but|CCONJ he|PRON does|AUX|do not|PART understand|VERB her|PRON|she .|PUNCT',
            'He|PRON|he feels|VERB|feel sad|ADJ ,|PUNCT and|CCONJ he|PRON leaves|VERB|leave his|PRON|he planet|NOUN .|PUNCT',
            'On|ADP|on the|DET last|ADJ morning|NOUN ,|PUNCT the|DET rose|NOUN says|VERB|say that|SCONJ she|PRON loves|VERB|love him|PRON|he .|PUNCT',
            'The|DET|the prince|NOUN flies|VERB|fly away|ADV with|ADP the|DET birds|NOUN|bird|Number=Plur .|PUNCT',
          ],
        },
        {
          title: '狐狸', sentences: [
            'On|ADP|on the|DET earth|NOUN ,|PUNCT the|DET prince|NOUN meets|VERB|meet a|DET fox|NOUN .|PUNCT',
            'The|DET|the fox|NOUN asks|VERB|ask the|DET prince|NOUN to|PART tame|VERB him|PRON|he .|PUNCT',
            'The|DET|the prince|NOUN comes|VERB|come every|DET day|NOUN and|CCONJ sits|VERB|sit a|DET little|ADJ closer|ADV|close .|PUNCT',
            'The|DET|the fox|NOUN waits|VERB|wait for|ADP the|DET prince|NOUN at|ADP the|DET same|ADJ time|NOUN .|PUNCT',
            'Now|ADV|now the|DET fox|NOUN is|AUX|be happy|ADJ when|SCONJ he|PRON hears|VERB|hear the|DET prince|NOUN .|PUNCT',
            'The|DET|the prince|NOUN learns|VERB|learn that|SCONJ his|PRON|he rose|NOUN is|AUX|be special|ADJ .|PUNCT',
            'The|DET|the fox|NOUN tells|VERB|tell him|PRON|he a|DET secret|NOUN about|ADP the|DET heart|NOUN .|PUNCT',
            'Important|ADJ|important things|NOUN|thing|Number=Plur are|AUX|be not|PART visible|ADJ to|ADP the|DET eyes|NOUN|eye|Number=Plur .|PUNCT',
          ],
        },
      ],
    },
  ],
};
