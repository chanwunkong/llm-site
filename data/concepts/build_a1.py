# 從 CEFR-J Wordlist 1.5 的 A1 實詞整理出「以圖像定義」的概念清單。
# 概念 ID 只是內部識別碼；意思由圖像與 gloss（給譯者的說明）界定，不綁任何語言。
# clarity：A = 圖像單獨就能明確表達；B = 圖像是慣用表示，需要搭配例句。
# Source: The CEFR-J Wordlist Version 1.5. Compiled by Yukio Tono, Tokyo University of Foreign Studies.
import csv, collections

RAW = """
# 動物
cat|🐱|NOUN|cat|A|動物|cat
dog|🐶|NOUN|dog|A|動物|dog
bird|🐦|NOUN|bird|A|動物|bird
fish|🐟|NOUN|fish|A|動物|fish (the animal)
horse|🐴|NOUN|horse|A|動物|horse
cow|🐄|NOUN|cow|A|動物|cow
pig|🐷|NOUN|pig|A|動物|pig
sheep|🐑|NOUN|sheep|A|動物|sheep
rabbit|🐰|NOUN|rabbit|A|動物|rabbit
mouse_animal|🐭|NOUN|mouse|A|動物|mouse (the animal)
rat|🐀|NOUN|rat|A|動物|rat
monkey|🐒|NOUN|monkey|A|動物|monkey
lion|🦁|NOUN|lion|A|動物|lion
tiger|🐯|NOUN|tiger|A|動物|tiger
bear|🐻|NOUN|bear|A|動物|bear (the animal)
bat_animal|🦇|NOUN|bat|A|動物|bat (the flying animal)
chicken_animal|🐔|NOUN|chicken|A|動物|chicken (the live bird)
turkey_animal|🦃|NOUN|turkey|A|動物|turkey (the bird)
frog|🐸|NOUN|frog|A|動物|frog
snake|🐍|NOUN|snake|A|動物|snake
bee|🐝|NOUN|bee|A|動物|bee
butterfly|🦋|NOUN|butterfly|A|動物|butterfly
fly_insect|🪰|NOUN|fly|A|動物|fly (the insect)
animal|🐾|NOUN|animal|B|動物|animal (general)
# 食物與飲料
apple|🍎|NOUN|apple|A|食物|apple
banana|🍌|NOUN|banana|A|食物|banana
orange_fruit|🍊|NOUN|orange|A|食物|orange (the fruit)
grape|🍇|NOUN|grape|A|食物|grape
tomato|🍅|NOUN|tomato|A|食物|tomato
potato|🥔|NOUN|potato|A|食物|potato
corn|🌽|NOUN|corn|A|食物|corn / maize
bean|🫘|NOUN|bean|A|食物|bean
vegetable|🥦|NOUN|vegetable|B|食物|vegetable (general)
bread|🍞|NOUN|bread|A|食物|bread
rice_cooked|🍚|NOUN|rice|A|食物|rice (cooked, as food)
egg|🥚|NOUN|egg|A|食物|egg
cheese|🧀|NOUN|cheese|A|食物|cheese
butter|🧈|NOUN|butter|A|食物|butter
meat|🍖|NOUN|meat|A|食物|meat
beef|🥩|NOUN|beef|B|食物|beef (meat of cattle)
chicken_meat|🍗|NOUN|chicken|B|食物|chicken (as food)
burger|🍔|NOUN|burger;hamburger|A|食物|hamburger
pizza|🍕|NOUN|pizza|A|食物|pizza
sandwich|🥪|NOUN|sandwich|A|食物|sandwich
salad|🥗|NOUN|salad|A|食物|salad
soup|🍲|NOUN|soup|A|食物|soup
cake|🍰|NOUN|cake|A|食物|cake
birthday_cake|🎂|NOUN|birthday|A|食物|birthday (shown as birthday cake)
cookie|🍪|NOUN|cookie;biscuit|A|食物|cookie / biscuit
candy|🍬|NOUN|candy|A|食物|candy / sweets
chocolate|🍫|NOUN|chocolate|A|食物|chocolate
ice_cream|🍦|NOUN|ice cream|A|食物|ice cream
water|💧|NOUN|water|A|食物|water
milk|🥛|NOUN|milk|A|食物|milk
coffee|☕|NOUN|coffee|A|食物|coffee
tea|🍵|NOUN|tea|A|食物|tea
juice|🧃|NOUN|juice|A|食物|juice
soda|🥤|NOUN|coke|B|食物|soft drink / cola
meal|🍽️|NOUN|meal;dinner|B|食物|meal
lunch_box|🍱|NOUN|lunch|B|食物|lunch (shown as a lunch box)
breakfast|🥞|NOUN|breakfast|B|食物|breakfast
# 人
baby|👶|NOUN|baby|A|人|baby
child|🧒|NOUN|child;kid|A|人|child
boy|👦|NOUN|boy|A|人|boy
girl|👧|NOUN|girl|A|人|girl
man|👨|NOUN|man|A|人|man
woman|👩|NOUN|woman;lady|A|人|woman
person|🧑|NOUN|person|A|人|person
people|👥|NOUN|people;group|B|人|people / group
family|👪|NOUN|family|A|人|family
grandfather|👴|NOUN|grandfather;grandpa|A|人|grandfather (also: old man)
grandmother|👵|NOUN|grandmother;grandma|A|人|grandmother (also: old woman)
friend|🧑‍🤝‍🧑|NOUN|friend|B|人|friend
doctor|🧑‍⚕️|NOUN|doctor/Dr./Dr|A|人|doctor
teacher|🧑‍🏫|NOUN|teacher|A|人|teacher
student|🧑‍🎓|NOUN|student|A|人|student
police|👮|NOUN|cop;officer|A|人|police officer
cook_person|🧑‍🍳|NOUN|cook|A|人|cook / chef
farmer|🧑‍🌾|NOUN|farmer|A|人|farmer
worker|👷|NOUN|worker|A|人|construction worker
scientist|🧑‍🔬|NOUN|scientist|A|人|scientist
engineer|🧑‍🔧|NOUN|engineer|B|人|engineer / mechanic
singer|🧑‍🎤|NOUN|singer;musician|A|人|singer
king|👑|NOUN|king|B|人|king (shown as a crown)
prince|🤴|NOUN|prince|A|人|prince
princess|👸|NOUN|princess|A|人|princess
fairy|🧚|NOUN|fairy|A|人|fairy
ghost|👻|NOUN|ghost|A|人|ghost
spy|🕵️|NOUN|spy|B|人|detective / spy
# 身體
eye|👁️|NOUN|eye|A|身體|eye
ear|👂|NOUN|ear|A|身體|ear
nose|👃|NOUN|nose|A|身體|nose
mouth|👄|NOUN|mouth|A|身體|mouth
tooth|🦷|NOUN|tooth|A|身體|tooth
hand|✋|NOUN|hand|A|身體|hand
leg|🦵|NOUN|leg|A|身體|leg
bone|🦴|NOUN|bone|A|身體|bone
brain|🧠|NOUN|brain|A|身體|brain
heart|❤️|NOUN|heart;love|B|身體|heart / love
face|🙂|NOUN|face|B|身體|face
haircut|💇|NOUN|haircut;hair|B|身體|haircut
# 衣物
shirt|👔|NOUN|shirt|A|衣物|shirt (with collar)
tshirt|👕|NOUN|T-shirt/tee-shirt;clothes|A|衣物|T-shirt
trousers|👖|NOUN|pants;trousers;jeans|A|衣物|trousers / jeans
dress|👗|NOUN|dress|A|衣物|dress
coat|🧥|NOUN|coat;jacket|A|衣物|coat / jacket
shoe|👟|NOUN|shoe|A|衣物|shoe
hat|👒|NOUN|hat|A|衣物|hat
cap|🧢|NOUN|cap|A|衣物|cap
glasses|👓|NOUN|glasses|A|衣物|glasses / spectacles
watch_clock|⌚|NOUN|watch|A|衣物|wristwatch
ring_jewel|💍|NOUN|jewelry/jewellery|B|衣物|ring / jewelry
bag|👜|NOUN|bag|A|衣物|bag
ribbon|🎀|NOUN|ribbon|A|衣物|ribbon
# 交通
car|🚗|NOUN|car|A|交通|car
bus|🚌|NOUN|bus|A|交通|bus
taxi|🚕|NOUN|taxi|A|交通|taxi
truck|🚚|NOUN|truck|A|交通|truck
train|🚆|NOUN|train|A|交通|train
subway|🚇|NOUN|subway|A|交通|subway / metro
bicycle|🚲|NOUN|bicycle;bike|A|交通|bicycle
airplane|✈️|NOUN|airplane/aeroplane;plane|A|交通|airplane
ship|🚢|NOUN|ship|A|交通|ship
boat|⛵|NOUN|boat|A|交通|boat
wheel|🛞|NOUN|wheel|A|交通|wheel
ticket|🎫|NOUN|ticket|A|交通|ticket
stop_sign|🛑|NOUN|stop|A|交通|stop (sign)
# 地點
house|🏠|NOUN|house;home|A|地點|house / home
building|🏢|NOUN|building|A|地點|building
school|🏫|NOUN|school|A|地點|school
hospital|🏥|NOUN|hospital|A|地點|hospital
hotel|🏨|NOUN|hotel|A|地點|hotel
bank|🏦|NOUN|bank|A|地點|bank (for money)
shop|🏪|NOUN|shop;store|A|地點|shop / store
supermarket|🛒|NOUN|supermarket|A|地點|supermarket
church|⛪|NOUN|church|A|地點|church
temple|🛕|NOUN|temple|A|地點|temple
factory|🏭|NOUN|factory|A|地點|factory
station|🚉|NOUN|station|A|地點|train station
airport|🛫|NOUN|airport|B|地點|airport
city|🏙️|NOUN|city|A|地點|city
town|🏘️|NOUN|town|B|地點|town
park|🏞️|NOUN|park|A|地點|park
beach|🏖️|NOUN|beach|A|地點|beach
island|🏝️|NOUN|island|A|地點|island
bridge|🌉|NOUN|bridge|B|地點|bridge
tower|🗼|NOUN|tower|B|地點|tower
palace|🏰|NOUN|palace|B|地點|palace / castle
cinema|🎦|NOUN|cinema|B|地點|cinema
street|🛣️|NOUN|street|B|地點|road / street
farm|🚜|NOUN|farm|B|地點|farm (shown as tractor)
camp|⛺|NOUN|camp|A|地點|camp / tent
zoo_world|🌍|NOUN|world|A|地點|world / Earth
# 自然與天氣
sun|☀️|NOUN|sun;sunny;sunshine|A|自然|sun (also: sunny)
moon|🌙|NOUN|moon|A|自然|moon
star|⭐|NOUN|star|A|自然|star
cloud|☁️|NOUN|cloud;cloudy|A|自然|cloud (also: cloudy)
rain|🌧️|NOUN|rain;rainy|A|自然|rain (also: rainy, it rains)
snow|❄️|NOUN|snow;snowy|A|自然|snow (also: snowy)
wind|🌬️|NOUN|wind|A|自然|wind
fire|🔥|NOUN|fire|A|自然|fire
ice|🧊|NOUN|ice|A|自然|ice
sea|🌊|NOUN|sea|A|自然|sea / wave
mountain|⛰️|NOUN|mountain;hill|A|自然|mountain
tree|🌳|NOUN|tree|A|自然|tree
flower|🌸|NOUN|flower|A|自然|flower
rose|🌹|NOUN|rose|A|自然|rose
leaf|🍃|NOUN|leaf|A|自然|leaf
grass|🌿|NOUN|grass|B|自然|grass / plant
stone|🪨|NOUN|stone|A|自然|stone / rock
hole|🕳️|NOUN|hole|A|自然|hole
smoke|💨|NOUN|smoke|B|自然|smoke / puff
autumn|🍂|NOUN|autumn|B|自然|autumn / fall
winter|⛄|NOUN|winter|B|自然|winter
morning|🌅|NOUN|morning|B|自然|morning (sunrise)
evening|🌆|NOUN|evening|B|自然|evening (dusk)
night|🌃|NOUN|night|B|自然|night
# 物品
book|📕|NOUN|book|A|物品|book
notebook|📓|NOUN|notebook|A|物品|notebook
pen|🖊️|NOUN|pen|A|物品|pen
pencil|✏️|NOUN|pencil|A|物品|pencil
ruler|📏|NOUN|ruler|A|物品|ruler (for measuring)
paper|📄|NOUN|paper;page|B|物品|paper / page
letter|✉️|NOUN|letter|A|物品|letter (mail)
mail|📬|NOUN|mail|B|物品|mail / mailbox
post|📮|NOUN|post|A|物品|post / postbox
email|📧|NOUN|email/e-mail/E-mail|A|物品|email
newspaper|📰|NOUN|newspaper;news|A|物品|newspaper
box|📦|NOUN|box|A|物品|box
bottle|🍾|NOUN|bottle|B|物品|bottle
bowl|🥣|NOUN|bowl|A|物品|bowl
glass_drink|🥃|NOUN|glass|B|物品|drinking glass
knife|🔪|NOUN|knife|A|物品|knife
bucket|🪣|NOUN|bucket|A|物品|bucket
key|🔑|NOUN|key|A|物品|key
door|🚪|NOUN|door|A|物品|door
window|🪟|NOUN|window|A|物品|window
chair|🪑|NOUN|chair|A|物品|chair
couch|🛋️|NOUN|couch;sofa|A|物品|sofa
bed|🛏️|NOUN|bed|A|物品|bed
bath|🛁|NOUN|bath|A|物品|bathtub / bath
shower|🚿|NOUN|shower|A|物品|shower
toilet|🚽|NOUN|toilet|A|物品|toilet
clock|🕐|NOUN|clock|A|物品|clock
bell|🔔|NOUN|bell|A|物品|bell
light_lamp|💡|NOUN|light|B|物品|light / light bulb
umbrella|☂️|NOUN|umbrella|A|物品|umbrella
camera|📷|NOUN|camera;photo|A|物品|camera
computer|💻|NOUN|computer|A|物品|computer
mouse_device|🖱️|NOUN|mouse|B|物品|computer mouse
mobile_phone|📱|NOUN|mobile;mobile phone;phone|A|物品|mobile phone
telephone|☎️|NOUN|telephone|A|物品|telephone (landline)
television|📺|NOUN|television;TV|A|物品|television
radio|📻|NOUN|radio|A|物品|radio
cd|💿|NOUN|CD|A|物品|CD
dvd|📀|NOUN|DVD|A|物品|DVD
file|📁|NOUN|file|A|物品|file / folder
list|📋|NOUN|list|B|物品|list / clipboard
note|📝|NOUN|note;homework|B|物品|note / memo
picture|🖼️|NOUN|picture;painting|A|物品|picture / painting
gift|🎁|NOUN|gift;present|A|物品|gift / present
money|💰|NOUN|money|A|物品|money
dollar|💵|NOUN|dollar|A|物品|dollar / banknote
credit_card|💳|NOUN|credit card|A|物品|credit card
price_tag|🏷️|NOUN|price|B|物品|price (tag)
medicine|💊|NOUN|medicine|A|物品|medicine / pill
flag|🚩|NOUN|flag|A|物品|flag
sign|🪧|NOUN|sign|B|物品|sign / placard
kite|🪁|NOUN|kite|A|物品|kite (toy)
doll|🪆|NOUN|doll|B|物品|doll
toy|🧸|NOUN|toy|B|物品|toy (teddy bear)
brush|🖌️|NOUN|brush|B|物品|paintbrush
saw|🪚|NOUN|saw|A|物品|saw (tool)
tool|🔧|NOUN|tool|B|物品|tool (wrench)
machine|⚙️|NOUN|machine|B|物品|machine (gear)
wall|🧱|NOUN|wall;block|B|物品|wall / bricks
seat|💺|NOUN|seat|A|物品|seat
vase|🏺|NOUN|vase|B|物品|vase / jar
piece|🧩|NOUN|piece|B|物品|piece (puzzle piece)
# 運動與娛樂
soccer|⚽|NOUN|soccer;football|A|運動娛樂|soccer / (association) football
american_football|🏈|NOUN|football|B|運動娛樂|American football
baseball|⚾|NOUN|baseball|A|運動娛樂|baseball
basketball|🏀|NOUN|basketball|A|運動娛樂|basketball
volleyball|🏐|NOUN|volleyball|A|運動娛樂|volleyball
tennis|🎾|NOUN|tennis|A|運動娛樂|tennis
goal|🥅|NOUN|goal|A|運動娛樂|goal (in sports)
sport|🏅|NOUN|sport;Olympics;contest|B|運動娛樂|sport / medal
game|🎮|NOUN|game|B|運動娛樂|(video) game
music|🎵|NOUN|music|A|運動娛樂|music
song|🎶|NOUN|song|B|運動娛樂|song
guitar|🎸|NOUN|guitar|A|運動娛樂|guitar
piano|🎹|NOUN|piano|A|運動娛樂|piano
drum|🥁|NOUN|drum|A|運動娛樂|drum
movie|🎬|NOUN|movie|A|運動娛樂|movie / film
theater|🎭|NOUN|theater/theatre;drama|B|運動娛樂|theater / drama
party|🎉|NOUN|party;celebration|A|運動娛樂|party / celebration
picnic|🧺|NOUN|picnic|A|運動娛樂|picnic (basket)
fishing|🎣|NOUN|fishing|A|運動娛樂|fishing
shopping|🛍️|NOUN|shopping|A|運動娛樂|shopping / buy
smoking|🚬|NOUN|smoking|A|運動娛樂|smoking
# 符號與抽象（慣用圖示）
question|❓|NOUN|question|A|符號|question
idea|💭|NOUN|idea;dream|B|符號|thought / idea
conversation|💬|NOUN|conversation;message|B|符號|conversation / message
peace|☮️|NOUN|peace|B|符號|peace
circle|⭕|NOUN|circle|A|符號|circle
internet|🌐|NOUN|Internet/internet|B|符號|internet
information|ℹ️|NOUN|information|B|符號|information
math|➕|NOUN|math/maths|B|符號|math
science|🔬|NOUN|science|B|符號|science
history|📜|NOUN|history|B|符號|history (scroll)
language|🗣️|NOUN|language;speech|B|符號|speaking / language
vote|🗳️|NOUN|vote|A|符號|vote / ballot box
fever|🤒|NOUN|fever|A|身體|fever / being ill
cold_illness|🤧|NOUN|cold|B|身體|a cold (illness)
kiss|💋|NOUN|kiss|A|動作|kiss
# 顏色
red|🟥|ADJ|red|A|顏色|red
blue|🟦|ADJ|blue|A|顏色|blue
green|🟩|ADJ|green|A|顏色|green
yellow|🟨|ADJ|yellow|A|顏色|yellow
orange_color|🟧|ADJ|orange|A|顏色|orange (the colour)
purple|🟪|ADJ|purple|A|顏色|purple
brown|🟫|ADJ|brown|A|顏色|brown
black|⬛|ADJ|black|A|顏色|black
white|⬜|ADJ|white|A|顏色|white
# 動作
run|🏃|VERB|run|A|動作|run
walk|🚶|VERB|walk|A|動作|walk
swim|🏊|VERB|swim;swimming|A|動作|swim
dance|💃|VERB|dance;dancing|A|動作|dance
climb|🧗|VERB|climb|A|動作|climb
ride_bike|🚴|VERB|ride|A|動作|ride (a bicycle)
surf|🏄|VERB|surf|A|動作|surf
exercise|🏋️|VERB|exercise|A|動作|exercise / lift weights
sleep|😴|VERB|sleep|A|動作|sleep
eat|🍴|VERB|eat|B|動作|eat
cook|🍳|VERB|cook|A|動作|cook
write|✍️|VERB|write|A|動作|write
read|📖|VERB|read;reading|B|動作|read
paint|🎨|VERB|paint;draw;art|B|動作|paint / draw / art
sing|🎤|VERB|sing|B|動作|sing
laugh|😂|VERB|laugh|A|動作|laugh
smile|😊|VERB|smile|B|動作|smile
cry|😭|VERB|cry|A|動作|cry
think|🤔|VERB|think|A|動作|think
pray|🙏|VERB|pray;thanks|B|動作|pray / thank
greet|👋|VERB|greet;hello;hi;bye|A|動作|wave hello / goodbye
call|📞|VERB|call;phone|A|動作|call on the phone
look|👀|VERB|look;see;watch|B|動作|look / see
listen|🎧|VERB|listen;hear|B|動作|listen / hear (headphones)
cut|✂️|VERB|cut|A|動作|cut
wash|🧼|VERB|wash|B|動作|wash (with soap)
brush_teeth|🪥|VERB|brush|B|動作|brush (teeth)
clean|🧹|VERB|clean|B|動作|clean / sweep
build|🏗️|VERB|build|B|動作|build
grow|🌱|VERB|grow|A|動作|grow (plant)
fly|🕊️|VERB|fly|B|動作|fly (bird flying)
dig|⛏️|VERB|dig|B|動作|dig
win|🏆|VERB|win|A|動作|win
fight|🥊|VERB|fight|B|動作|fight / box
celebrate|🥳|VERB|celebrate|A|動作|celebrate
pay|💸|VERB|pay|B|動作|pay (money going out)
travel|🧳|VERB|travel;trip|B|動作|travel / trip
wait|⏳|VERB|wait|B|動作|wait
wake|⏰|VERB|wake|B|動作|wake up (alarm clock)
hurt|🤕|VERB|hurt|A|動作|hurt / get injured
hide|🙈|VERB|hide|B|動作|hide / cover eyes
# 感受與狀態
happy|😄|ADJ|happy;glad|B|感受|happy
sad|😢|ADJ|sad|A|感受|sad
angry|😠|ADJ|angry|A|感受|angry
afraid|😨|ADJ|afraid|A|感受|afraid / scared
tired|😫|ADJ|tired|A|感受|tired
excited|🤩|ADJ|excited;exciting|A|感受|excited
bored|🥱|ADJ|boring|B|感受|bored / boring
funny|😆|ADJ|funny|B|感受|funny
surprised|😮|ADJ|surprise|B|感受|surprised
worried|😟|ADJ|worry|B|感受|worried
shy|😳|ADJ|shy|B|感受|shy / embarrassed
sick|🤢|ADJ|sick|B|感受|sick / feeling ill
hot_feel|🥵|ADJ|hot|A|感受|hot (a person feeling hot / hot weather)
cold_feel|🥶|ADJ|cold|A|感受|cold (a person feeling cold / cold weather)
delicious|😋|ADJ|delicious|A|感受|delicious / tasty
cool|😎|ADJ|cool|B|感受|cool (stylish)
strong|💪|ADJ|strong;arm|B|感受|strong (flexed arm)
rich|🤑|ADJ|rich|B|感受|rich
lucky|🍀|ADJ|lucky;luck|B|感受|lucky / luck
foggy|🌫️|ADJ|foggy|A|感受|foggy
correct|✅|ADJ|correct;right;true|A|感受|correct / right
wrong|❌|ADJ|wrong;false|A|感受|wrong / incorrect
good|👍|ADJ|good;OK/okay;fine|B|感受|good / OK
bad|👎|ADJ|bad|B|感受|bad

# ---- 組合圖示：場所＋用途 ----
kitchen|place:🏠+🍳|NOUN|kitchen|B|地點|kitchen
bedroom|place:🏠+🛏️|NOUN|bedroom|B|地點|bedroom
bathroom|place:🏠+🛁|NOUN|bathroom|B|地點|bathroom
living_room|place:🏠+🛋️|NOUN|living room|B|地點|living room
dining_room|place:🏠+🍽️|NOUN|dining room|B|地點|dining room
garden|place:🏠+🌷|NOUN|garden|B|地點|garden
classroom|place:🏫+🪑|NOUN|classroom|B|地點|classroom
library|place:🏛️+📚|NOUN|library|B|地點|library
bookstore|place:🏪+📚|NOUN|bookstore|B|地點|bookstore
cafe|place:🏪+☕|NOUN|cafe/café|B|地點|café
restaurant|place:🏪+🍽️|NOUN|restaurant|B|地點|restaurant
office|place:🏢+💼|NOUN|office|B|地點|office
swimming_pool|place:🏢+🏊|NOUN|swimming pool|B|地點|swimming pool
field|🌾|NOUN|field|B|自然|field (of crops)
# ---- 組合圖示：人＋工作 ----
nurse|role:🧑+💉|NOUN|nurse|B|人|nurse
waiter|role:🧑+🍽️|NOUN|waiter;waitress|B|人|waiter / waitress (person serving food)
driver|role:🧑+🚗|NOUN|driver|B|人|driver
actor|role:🧑+🎬|NOUN|actor|B|人|actor
live|role:🧑+🏠|VERB|live|B|動作|live (somewhere)
work|role:🧑+💼|VERB|work;job|B|動作|work / job
# ---- 組合圖示：動作 A→B ----
buy|action:💵>🛍️|VERB|buy|B|動作|buy (money becomes goods)
sell|action:🛍️>💵|VERB|sell|B|動作|sell (goods become money)
give|action:🎁>🧑|VERB|give|B|動作|give
drink|action:🥤>👄|VERB|drink|B|動作|drink
arrive|action:🚆>🚉|VERB|arrive|B|動作|arrive
kick|action:🦵>⚽|VERB|kick|B|動作|kick
catch|action:⚾>🧤|VERB|catch|B|動作|catch
teach|action:🧑‍🏫>🧑‍🎓|VERB|teach|B|動作|teach
learn|action:📚>🧠|VERB|learn;study|B|動作|learn / study
ask|action:🧑>❓|VERB|ask|B|動作|ask (a question)
answer|action:❓>✅|VERB|answer|B|動作|answer
wear_clothes|action:👕>🧑|VERB|wear|B|動作|wear / put on (clothes on the body)
wear_shoes|action:👟>🦶|VERB|wear|B|動作|wear / put on (shoes)
wear_hat|action:🧢>🧑|VERB|wear|B|動作|wear / put on (a hat)
sit|action:🧑>🪑|VERB|sit|B|動作|sit (down)
# ---- 其他單一圖示 ----
find|🔍|VERB|find|B|動作|find / look for
agree|🤝|VERB|agree|B|動作|agree / shake hands
repeat|🔁|VERB|repeat|B|動作|repeat
focus|🎯|VERB|focus|B|動作|focus / aim
welcome|🤗|VERB|welcome|B|動作|welcome / hug
finish|🏁|VERB|finish|B|動作|finish (finish line)
# ---- 組合圖示：對比（* 標記的那個就是答案）----
big|contrast:*🐘|🐭|ADJ|big;large|B|感受|big
small|contrast:🐘|*🐭|ADJ|small;little|B|感受|small
fast|contrast:*🐇|🐢|ADJ|fast;quickly|B|感受|fast
slow|contrast:🐇|*🐢|ADJ|slow|B|感受|slow
old_thing|contrast:*🏚️|🏠|ADJ|old|B|感受|old (of a thing)
new|contrast:🏚️|*🏠|ADJ|new|B|感受|new
young|contrast:*🧒|👴|ADJ|young|B|感受|young
heavy|contrast:*🪨|🪶|ADJ|heavy|B|感受|heavy
light_weight|contrast:🪨|*🪶|ADJ|light|B|感受|light (not heavy)
hot_touch|contrast:*🔥|🧊|ADJ|hot|B|感受|hot (to the touch, of things)
cold_touch|contrast:🔥|*🧊|ADJ|cold|B|感受|cold (to the touch, of things)
open|contrast:*🔓|🔒|ADJ|open|B|感受|open
closed|contrast:🔓|*🔒|ADJ|closed;close|B|感受|closed / close
dark|contrast:*🌑|🌕|ADJ|dark|B|感受|dark
bright|contrast:🌑|*🌕|ADJ|bright|B|感受|bright
long|contrast:*🐍|🐛|ADJ|long|B|感受|long
short_length|contrast:🐍|*🐛|ADJ|short|B|感受|short (not long)
tall|contrast:*🦒|🐧|ADJ|tall|B|感受|tall
short_height|contrast:🦒|*🐧|ADJ|short|B|感受|short (not tall)
"""

# 具體、日常、但沒有合適 emoji 的字：需要另外找圖示（例如 OpenMoji）或自行繪製
NEED_ICON = """table cup desk towel shelf apron pocket skirt knee neck shoulder back hair arm ball headache
river yard floor room dictionary magazine poster album card board pair tube pet
uncle aunt brother sister son daughter husband wife cousin parent""".split()

rows = []
for line in RAW.strip().splitlines():
    if not line.strip() or line.startswith('#'): continue
    parts = line.split('|')
    if parts[1].startswith('contrast:'):
        parts[1:3] = [parts[1] + '|' + parts[2]]
    cid, icon, upos, heads, clarity, cat, gloss = parts
    template, _, spec = icon.partition(':') if ':' in icon else ('single', '', icon)
    main = spec.replace('*', '').replace('>', '+').replace('|', '+').split('+')[0]
    rows.append(dict(id=cid, emoji=main, template=template, icon=spec, upos=upos, cefrj_headwords=heads, clarity=clarity, category=cat, gloss=gloss))

ids = [r['id'] for r in rows]
dup = [i for i, c in collections.Counter(ids).items() if c > 1]
assert not dup, dup

# 核對：每個 headword 都要在 CEFR-J A1 裡
src = list(csv.DictReader(open('cefrj-vocabulary-profile-1.5.csv', encoding='utf-8-sig')))
a1 = {r['headword'] for r in src if r['CEFR'] == 'A1'}
missing = sorted({h for r in rows for h in r['cefrj_headwords'].split(';') if h not in a1})

with open('concepts-a1.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['id', 'template', 'icon', 'emoji', 'upos', 'clarity', 'category', 'gloss', 'cefrj_headwords'])
    w.writeheader()
    w.writerows(rows)
with open('concepts-a1-need-icon.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(NEED_ICON) + '\n')

print('concepts:', len(rows), '| A:', sum(r['clarity'] == 'A' for r in rows), '| B:', sum(r['clarity'] == 'B' for r in rows))
print('by category:', dict(collections.Counter(r['category'] for r in rows)))
print('by upos:', dict(collections.Counter(r['upos'] for r in rows)))
emo = collections.Counter(r['icon'] for r in rows)
print('shared icon:', {e: [r['id'] for r in rows if r['icon'] == e] for e, c in emo.items() if c > 1})
print('by template:', dict(collections.Counter(r['template'] for r in rows)))
print('headwords not in A1:', missing)
print('need icon:', len(NEED_ICON))
