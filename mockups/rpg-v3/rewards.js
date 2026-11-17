window.ORI_REWARDS = {
  items: [
    // 9 прежних товаров: id, названия и цены сохранены.
    {
      id: 'plant', name: 'Звёздный цветок', category: 'decor', price: 30,
      who: 'ori',
      description: 'Цветок с лепестками-звёздочками для нашей комнаты.',
      interaction: 'Нажатие раскрывает пять лепестков по очереди; повторное нажатие складывает их в бутон.',
      artBrief: 'Один бирюзовый горшок, упругий стебель и пять лиловых лепестков вокруг тёплой звёздной сердцевины; без лица.',
      color: '#A985E8', shape: 'plant', purchaseLine: 'plant_purchase', tapLine: 'plant_tap'
    },
    {
      id: 'garland', name: 'Гирлянда', category: 'decor', price: 35,
      who: 'alien1',
      description: 'Мягкие огоньки на дуге над полкой.',
      interaction: 'Нажатие медленно проводит свет слева направо по семи лампочкам, затем возвращает ровное свечение.',
      artBrief: 'Короткая изогнутая нить с семью округлыми лампочками, мятными, золотистыми и лиловыми; без резкого свечения.',
      color: '#F2CB66', shape: 'room', purchaseLine: 'garland_purchase', tapLine: 'garland_tap'
    },
    {
      id: 'lamp', name: 'Лампа-планета', category: 'decor', price: 40,
      who: 'alien3',
      description: 'Настольная планета с уютным светом.',
      interaction: 'Нажатие переключает три состояния: тёплый свет, прохладный свет и выключено; освещение заданий не меняется.',
      artBrief: 'Лиловый шар-плафон в золотом кольце на низкой синей подставке; свет локальный, без засветки силуэта.',
      color: '#B4A2F2', shape: 'lamp', purchaseLine: 'lamp_purchase', tapLine: 'lamp_tap'
    },
    {
      id: 'holo', name: 'Голограмма', category: 'decor', price: 45,
      who: 'alien1',
      description: 'Маленькая Земля над игрушечным проектором.',
      interaction: 'Горизонтальное перетаскивание поворачивает глобус; короткое нажатие возвращает исходный вид Земли.',
      artBrief: 'Округлый бело-синий проектор и парящий над ним сине-зелёный глобус; материки без подписей и границ.',
      color: '#65D1D9', shape: 'room', purchaseLine: 'holo_purchase', tapLine: 'holo_tap'
    },
    {
      id: 'confetti', name: 'Конфетти', category: 'effects', price: 50,
      who: 'alien2',
      description: 'Бумажный дождик для праздника в комнате.',
      interaction: 'Нажатие выпускает одну порцию из двенадцати крупных бумажек над ковром; они опускаются и исчезают за две секунды.',
      artBrief: 'Крупные округлые бумажные ленточки мятного, лилового и золотого цветов; достаточно векторной анимации.',
      color: '#F0B66D', shape: 'effect', purchaseLine: 'confetti_purchase', tapLine: 'confetti_tap'
    },
    {
      id: 'fireworks', name: 'Салют', category: 'effects', price: 55,
      who: 'ori',
      description: 'Тихий звёздный салют за иллюминатором.',
      interaction: 'Нажатие рисует за окном три медленно раскрывающиеся звезды по очереди; без взрывного звука и белых вспышек.',
      artBrief: 'Три мягкие радиальные розетки из звёздных точек на прозрачном слое после ручной подготовки; можно выполнить в CSS.',
      color: '#EBC879', shape: 'effect', purchaseLine: 'fireworks_purchase', tapLine: 'fireworks_tap'
    },
    {
      id: 'music', name: 'Музыкальный орбитрон', category: 'decor', price: 60,
      who: 'alien2',
      description: 'Игрушечный проигрыватель коротких мелодий.',
      interaction: 'Нажатие запускает следующую из трёх заранее заданных мелодий на четыре секунды; нажатие во время звучания останавливает её. При выключенном звуке только поворачивается диск.',
      artBrief: 'Круглый мятный проигрыватель с лиловым диском, тремя выпуклыми кнопками без символов и маленьким раструбом.',
      color: '#8BD4C1', shape: 'room', purchaseLine: 'music_purchase', tapLine: 'music_tap'
    },
    {
      id: 'robot', name: 'Робот-помощник', category: 'decor', price: 75,
      who: 'alien1',
      description: 'Игрушечный робот машет нам рукой. Учебных подсказок не даёт.',
      interaction: 'Нажатие поднимает ладонь робота для приветствия; нажатие на поднятую ладонь запускает жест «дай пять» и возвращает руку вниз.',
      artBrief: 'Небольшой бело-голубой игрушечный робот с двумя круглыми глазами-индикаторами и широкой безопасной ладонью.',
      color: '#78BCE8', shape: 'robot', purchaseLine: 'robot_purchase', tapLine: 'robot_tap'
    },
    {
      id: 'paint', name: 'Цвет каюты', category: 'themes', price: 90,
      who: 'ori',
      description: 'Четыре спокойных цвета стен на выбор.',
      interaction: 'Нажатие открывает четыре фиксированных образца стен: космос, аврора, сирень и солнечный. Выбор меняет только стены, кнопка отмены возвращает предыдущий цвет.',
      artBrief: 'Отдельная растровая картинка не нужна: четыре CSS-образца цвета стены и условная векторная кисть в карточке.',
      color: '#A888CF', shape: 'theme', purchaseLine: 'paint_purchase', tapLine: 'paint_tap'
    },
    // 6 питомцев: спутники комнаты без ухода, отдельного голоса и бонусов.
    {
      id: 'pet_snail', name: 'Облачная улитка', category: 'pets', price: 60,
      who: 'alien2',
      description: 'Маленькая улитка с раковиной, похожей на облако.',
      interaction: 'Нажатие заставляет улитку высунуть рожки и проползти короткую дугу; серебристая дорожка плавно исчезает.',
      artBrief: 'Мятная игрушечная улитка с двумя глазками на рожках и раковиной из трёх сливочных завитков, маленькая относительно учеников.',
      color: '#B3DED0', shape: 'pet', purchaseLine: 'pet_snail_purchase', tapLine: 'pet_snail_tap'
    },
    {
      id: 'pet_bunny', name: 'Лунный зайчонок', category: 'pets', price: 80,
      who: 'alien3',
      description: 'Пушистый зайчонок с длинными серебристыми ушками.',
      interaction: 'Нажатие запускает два невысоких прыжка на месте, после которых зайчонок складывает уши крест-накрест.',
      artBrief: 'Серебристо-голубой плюшевый зайчонок, два глаза, два длинных уха, округлые лапки и крошечная лиловая звезда на ошейнике.',
      color: '#BCD8F0', shape: 'pet', purchaseLine: 'pet_bunny_purchase', tapLine: 'pet_bunny_tap'
    },
    {
      id: 'pet_cat', name: 'Звёздный котёнок', category: 'pets', price: 100,
      who: 'alien1',
      description: 'Котёнок с пятнышком-звездой и мягким хвостом.',
      interaction: 'Перетаскивание игрушечного клубка в пределах ковра поворачивает голову котёнка вслед за ним; после отпускания котёнок касается клубка лапой.',
      artBrief: 'Персиковый плюшевый котёнок с белым пятном-звездой на боку и лиловым клубком у передней лапы; два глаза, четыре лапы.',
      color: '#F1BB96', shape: 'pet', purchaseLine: 'pet_cat_purchase', tapLine: 'pet_cat_tap'
    },
    {
      id: 'pet_turtle', name: 'Черепашка-комета', category: 'pets', price: 120,
      who: 'ori',
      description: 'Спокойная черепашка с узором орбиты на панцире.',
      interaction: 'Нажатие мягко подсвечивает дорожку-орбиту на панцире; черепашка прячет голову на мгновение и снова выглядывает.',
      artBrief: 'Небольшая салатовая черепашка с округлым бирюзовым панцирем и одной золотой дугой орбиты; без ракет и двигателей.',
      color: '#8ACBB8', shape: 'pet', purchaseLine: 'pet_turtle_purchase', tapLine: 'pet_turtle_tap'
    },
    {
      id: 'pet_fox', name: 'Лисёнок-искорка', category: 'pets', price: 160,
      who: 'alien2',
      description: 'Рыжий лисёнок с большим кремовым кончиком хвоста.',
      interaction: 'Нажатие прячет мордочку лисёнка за хвостом; следующее открывает её с наклоном головы, как в игре в прятки.',
      artBrief: 'Рыже-персиковый плюшевый лисёнок с двумя глазами, крупными ушами и пышным хвостом; никакого настоящего огня.',
      color: '#EFA36C', shape: 'pet', purchaseLine: 'pet_fox_purchase', tapLine: 'pet_fox_tap'
    },
    {
      id: 'pet_dragon', name: 'Дракончик облаков', category: 'pets', price: 250,
      who: 'ori',
      description: 'Добрый дракончик с маленькими крыльями. Чуть взлетает и выпускает облачное колечко.',
      interaction: 'Нажатие поднимает дракончика на высоту одной лапы; он выдыхает одно облачное колечко и садится. Колечко тает, огня нет.',
      artBrief: 'Небольшой мятно-лиловый дракончик-игрушка с двумя глазами, четырьмя лапами, парой коротких крыльев и тупыми рожками; дружелюбный, без оружия.',
      color: '#9BCFC3', shape: 'pet', purchaseLine: 'pet_dragon_purchase', tapLine: 'pet_dragon_tap'
    },
    // 12 нарядов: по четыре предмета для каждого ученика.
    {
      id: 'blip_hat', name: 'Шапочка Блипа «Орбита»', category: 'outfits', price: 45,
      who: 'alien1', owner: 'alien1',
      description: 'Мягкая шапочка с отверстиями для обеих антенн Блипа.',
      interaction: 'Нажатие приподнимает козырёк и возвращает его; антенны остаются открытыми и неподвижными.',
      artBrief: 'Только слой бело-синей шапочки с оранжевым козырьком по img/alien1.png; два отверстия под антенны, лицо и тело не рисовать.',
      color: '#6DB9E8', shape: 'hat', purchaseLine: 'blip_hat_purchase', tapLine: 'blip_hat_tap'
    },
    {
      id: 'blip_cape', name: 'Плащ Блипа «Маршрут»', category: 'outfits', price: 65,
      who: 'alien1', owner: 'alien1',
      description: 'Короткий синий плащ с оранжевой окантовкой.',
      interaction: 'Нажатие проводит маленький светлый блик вдоль дуги на плаще от плеча к подолу; никаких указателей правильного пути.',
      artBrief: 'Только короткий синий плащ позади корпуса img/alien1.png, оранжевый край и одна дуга без стрелок; костюм остаётся виден.',
      color: '#659DE0', shape: 'cape', purchaseLine: 'blip_cape_purchase', tapLine: 'blip_cape_tap'
    },
    {
      id: 'blip_boots', name: 'Накладки Блипа «Пружинки»', category: 'outfits', price: 55,
      who: 'alien1', owner: 'alien1',
      description: 'Оранжевые мягкие накладки поверх ботинок космонавта.',
      interaction: 'Нажатие по очереди сжимает и расправляет декоративные подошвы, не двигая героя по карте.',
      artBrief: 'Пара оранжевых накладок с двумя округлыми складками на подошвах, точно поверх существующих ботинок img/alien1.png; без новых ног.',
      color: '#F1AD57', shape: 'boots', purchaseLine: 'blip_boots_purchase', tapLine: 'blip_boots_tap'
    },
    {
      id: 'blip_badge', name: 'Значок Блипа «Планетка»', category: 'outfits', price: 30,
      who: 'alien1', owner: 'alien1',
      description: 'Маленькая планетка на рукаве, не вместо эмблемы костюма.',
      interaction: 'Нажатие поворачивает кольцо значка на половину оборота вокруг неподвижной планетки.',
      artBrief: 'Только объёмный значок синей планеты с золотым кольцом на наружной стороне опущенного рукава img/alien1.png; без надписей.',
      color: '#EFC863', shape: 'badge', purchaseLine: 'blip_badge_purchase', tapLine: 'blip_badge_tap'
    },
    {
      id: 'puf_hat', name: 'Берет Пуфа «Завиток»', category: 'outfits', price: 45,
      who: 'alien2', owner: 'alien2',
      description: 'Мятный берет между верхними отростками Пуфа.',
      interaction: 'Нажатие раскручивает мягкий завиток на берете в спираль, затем сворачивает обратно.',
      artBrief: 'Только небольшой мятный берет со спиральным помпоном по img/alien2.png; не закрывать ни один из трёх глаз и верхние отростки.',
      color: '#83D8C2', shape: 'hat', purchaseLine: 'puf_hat_purchase', tapLine: 'puf_hat_tap'
    },
    {
      id: 'puf_cape', name: 'Накидка Пуфа «Волна»', category: 'outfits', price: 65,
      who: 'alien2', owner: 'alien2',
      description: 'Короткая персиковая накидка с волнистым краем.',
      interaction: 'Нажатие поднимает край накидки одной плавной волной слева направо; щупальца свободны.',
      artBrief: 'Только задний слой короткой персиковой накидки с волнистым подолом, под анатомию img/alien2.png; без придуманной шеи или рук.',
      color: '#EDB599', shape: 'cape', purchaseLine: 'puf_cape_purchase', tapLine: 'puf_cape_tap'
    },
    {
      id: 'puf_boots', name: 'Манжеты Пуфа «Плюх»', category: 'outfits', price: 55,
      who: 'alien2', owner: 'alien2',
      description: 'Две мягкие манжеты на нижние щупальца, с открытыми концами.',
      interaction: 'Нажатие оставляет под двумя нижними щупальцами по одному декоративному кругу, как на воде; круги расходятся и исчезают.',
      artBrief: 'Только две бирюзовые манжеты вокруг нижних щупалец img/alien2.png; присоски и концы открыты, человеческих стоп не добавлять.',
      color: '#72C7D5', shape: 'boots', purchaseLine: 'puf_boots_purchase', tapLine: 'puf_boots_tap'
    },
    {
      id: 'puf_badge', name: 'Значок Пуфа «Ракушка»', category: 'outfits', price: 30,
      who: 'alien2', owner: 'alien2',
      description: 'Коралловая ракушка сбоку, под щупальцем.',
      interaction: 'Нажатие открывает две створки значка, показывая перламутровую серединку; повторное закрывает их.',
      artBrief: 'Только маленькая коралловая ракушка-значок на нижнем боку img/alien2.png, ниже рта; никаких изменений языка и пятен тела.',
      color: '#E99CAF', shape: 'badge', purchaseLine: 'puf_badge_purchase', tapLine: 'puf_badge_tap'
    },
    {
      id: 'kuku_hat', name: 'Шапочка Ку-Ку «Облачко»', category: 'outfits', price: 45,
      who: 'alien3', owner: 'alien3',
      description: 'Пушистая белая шапочка, не прячущая глаз и антенны.',
      interaction: 'Нажатие слегка надувает три округлые доли шапочки и возвращает прежнюю форму.',
      artBrief: 'Только белая облачная шапочка между двумя антеннами img/alien3.png, край выше единственного глаза; не рисовать героя заново.',
      color: '#D9EBF3', shape: 'hat', purchaseLine: 'kuku_hat_purchase', tapLine: 'kuku_hat_tap'
    },
    {
      id: 'kuku_cape', name: 'Накидка Ку-Ку «Ветерок»', category: 'outfits', price: 65,
      who: 'alien3', owner: 'alien3',
      description: 'Две короткие ленточные полы ниже крыльев.',
      interaction: 'Нажатие разводит две полы в стороны и мягко опускает; крылья героя остаются полностью открытыми.',
      artBrief: 'Только лиловая раздвоенная накидка под крыльями img/alien3.png; задний слой, не перекрывающий полупрозрачные крылья и мех.',
      color: '#B2A3E8', shape: 'cape', purchaseLine: 'kuku_cape_purchase', tapLine: 'kuku_cape_tap'
    },
    {
      id: 'kuku_boots', name: 'Гетры Ку-Ку «Топ-топ»', category: 'outfits', price: 55,
      who: 'alien3', owner: 'alien3',
      description: 'Жёлтые вязаные гетры над пушистыми лапами.',
      interaction: 'Нажатие по очереди покачивает два маленьких помпона на внешних сторонах гетр, без прыжка героя.',
      artBrief: 'Только пара золотистых гетр с помпонами над лапами img/alien3.png; пальцы и синий мех лап остаются видны.',
      color: '#EDCC79', shape: 'boots', purchaseLine: 'kuku_boots_purchase', tapLine: 'kuku_boots_tap'
    },
    {
      id: 'kuku_badge', name: 'Значок Ку-Ку «Капелька»', category: 'outfits', price: 30,
      who: 'alien3', owner: 'alien3',
      description: 'Сиреневая капелька на нижней части пушистого бока.',
      interaction: 'Нажатие наклоняет значок влево и вправо, перемещая перламутровый блик внутри капли.',
      artBrief: 'Только маленькая сиреневая капля-значок на нижнем боку img/alien3.png, вдали от глаза и крыльев; без букв.',
      color: '#C6A8E1', shape: 'badge', purchaseLine: 'kuku_badge_purchase', tapLine: 'kuku_badge_tap'
    },
    // 6 новых предметов комнаты.
    {
      id: 'room_cloud_seat', name: 'Кресло-облако', category: 'decor', price: 65,
      who: 'alien3',
      description: 'Кресло с мягкой округлой подушкой.',
      interaction: 'Нажатие продавливает середину подушки и медленно восстанавливает её форму, как у мягкой игрушки.',
      artBrief: 'Низкое кремово-голубое кресло из трёх облачных валиков на округлых ножках; без лица и сидящего героя.',
      color: '#C6DDEC', shape: 'room', purchaseLine: 'room_cloud_seat_purchase', tapLine: 'room_cloud_seat_tap'
    },
    {
      id: 'room_star_mobile', name: 'Звёздная подвеска', category: 'decor', price: 70,
      who: 'ori',
      description: 'Три звёздочки на лёгком коромысле.',
      interaction: 'Горизонтальный жест отклоняет подвеску в выбранную сторону; после отпускания три звезды качаются с разным, постепенно затухающим ритмом.',
      artBrief: 'Настольная дуга с тремя подвешенными объёмными звёздами разного размера на коротких нитях; широкое устойчивое основание.',
      color: '#DAC17C', shape: 'room', purchaseLine: 'room_star_mobile_purchase', tapLine: 'room_star_mobile_tap'
    },
    {
      id: 'room_bubble_window', name: 'Окно пузырьков', category: 'decor', price: 85,
      who: 'alien2',
      description: 'Круглая игрушечная панель с пузырьками за стеклом.',
      interaction: 'Нажатие создаёт три пузырька снизу панели; каждый поднимается, касается верхнего края и тихо исчезает.',
      artBrief: 'Настенная круглая бело-бирюзовая рама и светло-голубая стеклянная вставка с тремя крупными пузырьками, без живых существ.',
      color: '#A4DAE6', shape: 'room', purchaseLine: 'room_bubble_window_purchase', tapLine: 'room_bubble_window_tap'
    },
    {
      id: 'room_crystal_chime', name: 'Хрустальные колокольцы', category: 'decor', price: 95,
      who: 'alien1',
      description: 'Три безопасных игрушечных кристалла на стойке.',
      interaction: 'Нажатие на каждый из трёх кристаллов проигрывает свой тихий тон и слегка поворачивает только этот кристалл; при выключенном звуке остаётся поворот.',
      artBrief: 'Три округлых полупрозрачных кристалла мятного, розового и лилового цвета на компактной белой стойке, без острых концов.',
      color: '#A8BCE8', shape: 'room', purchaseLine: 'room_crystal_chime_purchase', tapLine: 'room_crystal_chime_tap'
    },
    {
      id: 'room_orbit_shelf', name: 'Полка-орбита', category: 'decor', price: 110,
      who: 'alien1',
      description: 'Круглая полка с тремя игрушечными камешками.',
      interaction: 'Нажатие на боковую ручку поворачивает внутренний круг на треть оборота, меняя местами три прикреплённых камешка.',
      artBrief: 'Невысокая кольцевая синяя полка на основании, три широких сектора с закреплёнными гладкими камешками и оранжевая ручка.',
      color: '#80ADD6', shape: 'room', purchaseLine: 'room_orbit_shelf_purchase', tapLine: 'room_orbit_shelf_tap'
    },
    {
      id: 'room_sky_globe', name: 'Шар с облачками', category: 'decor', price: 130,
      who: 'ori',
      description: 'За прозрачной стенкой живёт маленькое облачное небо.',
      interaction: 'Вертикальный жест внутри шара поднимает три облачка; после отпускания они медленно оседают. Устройство трясти не нужно.',
      artBrief: 'Большой игрушечный стеклянный шар на лиловом основании, внутри три кремовых облачка и маленькая золотистая луна.',
      color: '#BAC8EE', shape: 'room', purchaseLine: 'room_sky_globe_purchase', tapLine: 'room_sky_globe_tap'
    },
    // 5 новых эффектов: только ручной запуск в комнате.
    {
      id: 'effect_bubbles', name: 'Мыльные пузыри', category: 'effects', price: 40,
      who: 'alien2',
      description: 'Несколько больших радужных пузырей для игры взглядом.',
      interaction: 'Нажатие выпускает пять пузырей над ковром; нажатие на отдельный пузырь сжимает его в мягкое кольцо без хлопка.',
      artBrief: 'Пять тонких радужных колец с мягким объёмным бликом; достаточно CSS, растровая фактура необязательна.',
      color: '#A8DBDF', shape: 'effect', purchaseLine: 'effect_bubbles_purchase', tapLine: 'effect_bubbles_tap'
    },
    {
      id: 'effect_comet_trail', name: 'Хвост кометы', category: 'effects', price: 65,
      who: 'alien1',
      description: 'Золотистый след за пальцем внутри окна примерки.',
      interaction: 'Перетаскивание внутри площадки эффекта оставляет короткий след из восьми точек; каждая тает за секунду, за пределы площадки след не выходит.',
      artBrief: 'Короткая золотисто-персиковая дуга из восьми постепенно уменьшающихся точек; векторная анимация предпочтительна.',
      color: '#EBC379', shape: 'effect', purchaseLine: 'effect_comet_trail_purchase', tapLine: 'effect_comet_trail_tap'
    },
    {
      id: 'effect_petal_swirl', name: 'Вихрь лепестков', category: 'effects', price: 55,
      who: 'alien3',
      description: 'Лепестки кружатся вокруг пустого места на ковре.',
      interaction: 'Нажатие проводит шесть лепестков один круг по горизонтальному овалу; затем они плавно опускаются к центру и исчезают.',
      artBrief: 'Шесть крупных розово-лиловых лепестков с округлыми краями и мягкими тенями, без стеблей; CSS достаточен.',
      color: '#D7A2CB', shape: 'effect', purchaseLine: 'effect_petal_swirl_purchase', tapLine: 'effect_petal_swirl_tap'
    },
    {
      id: 'effect_soft_aurora', name: 'Лента сияния', category: 'effects', price: 90,
      who: 'ori',
      description: 'Спокойная световая лента у верхнего края окна.',
      interaction: 'Нажатие раскрывает одну мятно-лиловую ленту за три секунды и оставляет неподвижной; повторное нажатие убирает её без вспышки.',
      artBrief: 'Широкая полупрозрачная мятно-лиловая лента с гладким переходом цвета, без мелких искр; достаточно CSS-градиента.',
      color: '#A6CEC9', shape: 'effect', purchaseLine: 'effect_soft_aurora_purchase', tapLine: 'effect_soft_aurora_tap'
    },
    {
      id: 'effect_star_ripples', name: 'Звёздные круги', category: 'effects', price: 75,
      who: 'alien3',
      description: 'Три тонких звёздных круга расходятся по ковру.',
      interaction: 'Нажатие в пределах ковра рисует из точки касания три увеличивающихся контура со звёздочками; через две секунды контуры растворяются.',
      artBrief: 'Три плоских эллиптических контура, на каждом по четыре маленькие звезды, мягкий голубой свет; CSS или SVG достаточны.',
      color: '#91C9E5', shape: 'effect', purchaseLine: 'effect_star_ripples_purchase', tapLine: 'effect_star_ripples_tap'
    },
    // 6 новых тем: оформление комнаты, не темы уроков и не доступ к главам.
    {
      id: 'theme_dawn', name: 'Персиковый рассвет', category: 'themes', price: 85,
      who: 'ori',
      description: 'Персиковые стены и спокойное утреннее небо за окном.',
      interaction: 'Нажатие в примерке переключает вид за окном между солнцем у горизонта и солнцем чуть выше; применение темы подтверждается отдельно.',
      artBrief: 'Фоновая пластина каюты: персиковые стены, кремовый пол, круглое окно с мягким рассветом; без героев и текста.',
      color: '#E9B49C', shape: 'theme', purchaseLine: 'theme_dawn_purchase', tapLine: 'theme_dawn_tap'
    },
    {
      id: 'theme_mint_garden', name: 'Мятный сад', category: 'themes', price: 100,
      who: 'alien1',
      description: 'Светлая комната с нарисованными листьями вдоль края стен.',
      interaction: 'Нажатие на нижний угол стены разворачивает крупный листовой узор; повторное складывает его, не закрывая мебель и интерфейс.',
      artBrief: 'Фоновая пластина каюты: светло-мятные стены и крупные рельефные листья только по внешним краям, чистая середина.',
      color: '#B4D9BC', shape: 'theme', purchaseLine: 'theme_mint_garden_purchase', tapLine: 'theme_mint_garden_tap'
    },
    {
      id: 'theme_coral_bay', name: 'Коралловая бухта', category: 'themes', price: 115,
      who: 'alien2',
      description: 'Песочные стены и морская гладь за круглым окном.',
      interaction: 'Горизонтальный жест по окну перемещает одну широкую волну вслед за пальцем; после отпускания море снова неподвижно.',
      artBrief: 'Фоновая пластина каюты: песочно-кремовые стены, коралловая окантовка окна, за ним тихое бирюзовое море.',
      color: '#DEAF9C', shape: 'theme', purchaseLine: 'theme_coral_bay_purchase', tapLine: 'theme_coral_bay_tap'
    },
    {
      id: 'theme_lavender_night', name: 'Сиреневая ночь', category: 'themes', price: 125,
      who: 'alien3',
      description: 'Сиреневая комната с большой луной за окном.',
      interaction: 'Нажатие на луну переключает полумесяц и полный круг; яркость текста и учебных карточек остаётся прежней.',
      artBrief: 'Фоновая пластина каюты: светло-сиреневые стены, сине-лиловое небо в окне и одна кремовая луна; не затемнять зону интерфейса.',
      color: '#B5A7D6', shape: 'theme', purchaseLine: 'theme_lavender_night_purchase', tapLine: 'theme_lavender_night_tap'
    },
    {
      id: 'theme_cloud_harbor', name: 'Облачная пристань', category: 'themes', price: 140,
      who: 'alien1',
      description: 'Голубая каюта с далёкой пристанью среди облаков.',
      interaction: 'Нажатие на окно проводит один маленький безымянный кораблик от левого края к причалу; он остаётся у причала до повторного нажатия.',
      artBrief: 'Фоновая пластина каюты: голубые стены, белые округлые балки и дальняя воздушная пристань за окном; без персонажей.',
      color: '#A7CBE1', shape: 'theme', purchaseLine: 'theme_cloud_harbor_purchase', tapLine: 'theme_cloud_harbor_tap'
    },
    {
      id: 'theme_amber_library', name: 'Янтарная библиотека', category: 'themes', price: 150,
      who: 'ori',
      description: 'Тёплая каюта с нарисованной книжной нишей.',
      interaction: 'Нажатие на книжную нишу выдвигает одну декоративную книгу и раскрывает пустой разворот; повторное закрывает и убирает книгу. Подсказок внутри нет.',
      artBrief: 'Фоновая пластина каюты: медово-кремовые стены, округлая боковая ниша с несколькими книгами без надписей, свободный центр.',
      color: '#D8BA88', shape: 'theme', purchaseLine: 'theme_amber_library_purchase', tapLine: 'theme_amber_library_tap'
    }
  ],
  lines: [
    // По две реплики на каждый товар; говорят только Ори и три ученика.
    { id: 'plant_purchase', who: 'ori', event: 'purchase', text: 'У нас появился звёздный цветок!' },
    { id: 'plant_tap', who: 'ori', event: 'tap', text: 'О, лепестки просыпаются!' },
    { id: 'garland_purchase', who: 'alien1', event: 'purchase', text: 'Повешу огоньки над полкой!' },
    { id: 'garland_tap', who: 'alien1', event: 'tap', text: 'Свет побежал по проводку!' },
    { id: 'lamp_purchase', who: 'alien3', event: 'purchase', text: 'Уютная планета. Мне нравится!' },
    { id: 'lamp_tap', who: 'alien3', event: 'tap', text: 'У света теперь другой оттенок.' },
    { id: 'holo_purchase', who: 'alien1', event: 'purchase', text: 'Земля поместилась на столе!' },
    { id: 'holo_tap', who: 'alien1', event: 'tap', text: 'Повернём к нам океан?' },
    { id: 'confetti_purchase', who: 'alien2', event: 'purchase', text: 'Бумажный дождик — вот это да!' },
    { id: 'confetti_tap', who: 'alien2', event: 'tap', text: 'Ленточки летят так плавно!' },
    { id: 'fireworks_purchase', who: 'ori', event: 'purchase', text: 'Звёздный салют поселился за окном.' },
    { id: 'fireworks_tap', who: 'ori', event: 'tap', text: 'Три звезды раскрылись в тишине.' },
    { id: 'music_purchase', who: 'alien2', event: 'purchase', text: 'Теперь можно устроить маленький концерт!' },
    { id: 'music_tap', who: 'alien2', event: 'tap', text: 'Диск крутится — я тоже покачаюсь!' },
    { id: 'robot_purchase', who: 'alien1', event: 'purchase', text: 'Какой забавный игрушечный робот!' },
    { id: 'robot_tap', who: 'alien1', event: 'tap', text: 'Ладошка готова. Дадим пять?' },
    { id: 'paint_purchase', who: 'ori', event: 'purchase', text: 'Теперь стены можно перекрашивать.' },
    { id: 'paint_tap', who: 'ori', event: 'tap', text: 'Какой цвет выберем сегодня?' },
    { id: 'pet_snail_purchase', who: 'alien2', event: 'purchase', text: 'Улитка! У неё целое облачко на спине.' },
    { id: 'pet_snail_tap', who: 'alien2', event: 'tap', text: 'Смотри, серебристая дорожка!' },
    { id: 'pet_bunny_purchase', who: 'alien3', event: 'purchase', text: 'Зайчонок такой же пушистый, как я!' },
    { id: 'pet_bunny_tap', who: 'alien3', event: 'tap', text: 'Прыг, прыг! А ушки крестиком.' },
    { id: 'pet_cat_purchase', who: 'alien1', event: 'purchase', text: 'Для котёнка найдётся место на ковре.' },
    { id: 'pet_cat_tap', who: 'alien1', event: 'tap', text: 'Клубок туда — и взгляд туда!' },
    { id: 'pet_turtle_purchase', who: 'ori', event: 'purchase', text: 'Черепашка принесла свою маленькую орбиту.' },
    { id: 'pet_turtle_tap', who: 'ori', event: 'tap', text: 'Вот она выглянула из панциря.' },
    { id: 'pet_fox_purchase', who: 'alien2', event: 'purchase', text: 'У лисёнка хвост словно подушка!' },
    { id: 'pet_fox_tap', who: 'alien2', event: 'tap', text: 'Кто там за хвостом? Вижу нос!' },
    { id: 'pet_dragon_purchase', who: 'ori', event: 'purchase', text: 'Дракончик с нами. Какой мягкий взмах!' },
    { id: 'pet_dragon_tap', who: 'ori', event: 'tap', text: 'Облачное колечко плывёт к окну.' },
    { id: 'blip_hat_purchase', who: 'alien1', event: 'purchase', text: 'Обе антенны свободны. Отличная шапочка!' },
    { id: 'blip_hat_tap', who: 'alien1', event: 'tap', text: 'Козырёк вверх — привет!' },
    { id: 'blip_cape_purchase', who: 'alien1', event: 'purchase', text: 'Синий плащ подходит к моему костюму.' },
    { id: 'blip_cape_tap', who: 'alien1', event: 'tap', text: 'По дуге пробежал блик!' },
    { id: 'blip_boots_purchase', who: 'alien1', event: 'purchase', text: 'Мои ботинки теперь с мягкими складками.' },
    { id: 'blip_boots_tap', who: 'alien1', event: 'tap', text: 'Пружинка сжалась и расправилась!' },
    { id: 'blip_badge_purchase', who: 'alien1', event: 'purchase', text: 'Маленькая планета на моём рукаве!' },
    { id: 'blip_badge_tap', who: 'alien1', event: 'tap', text: 'Кольцо сделало пол-оборота.' },
    { id: 'puf_hat_purchase', who: 'alien2', event: 'purchase', text: 'Берет сидит хорошо. Все три глаза видят!' },
    { id: 'puf_hat_tap', who: 'alien2', event: 'tap', text: 'Ого, завиток расправился!' },
    { id: 'puf_cape_purchase', who: 'alien2', event: 'purchase', text: 'Накидка волнистая, как мои щупальца.' },
    { id: 'puf_cape_tap', who: 'alien2', event: 'tap', text: 'По краю бежит волна!' },
    { id: 'puf_boots_purchase', who: 'alien2', event: 'purchase', text: 'Мягкие манжеты, а присоски свободны!' },
    { id: 'puf_boots_tap', who: 'alien2', event: 'tap', text: 'Плюх — и круги разбежались!' },
    { id: 'puf_badge_purchase', who: 'alien2', event: 'purchase', text: 'Ракушка устроилась у меня на боку.' },
    { id: 'puf_badge_tap', who: 'alien2', event: 'tap', text: 'Внутри перламутр. Красиво!' },
    { id: 'kuku_hat_purchase', who: 'alien3', event: 'purchase', text: 'На голове облачко. Как мягко!' },
    { id: 'kuku_hat_tap', who: 'alien3', event: 'tap', text: 'Облачко стало чуть пышнее.' },
    { id: 'kuku_cape_purchase', who: 'alien3', event: 'purchase', text: 'Крыльям просторно. Можно расправить!' },
    { id: 'kuku_cape_tap', who: 'alien3', event: 'tap', text: 'Две ленточки поймали ветерок.' },
    { id: 'kuku_boots_purchase', who: 'alien3', event: 'purchase', text: 'Жёлтые гетры и синие лапы. Мне идёт!' },
    { id: 'kuku_boots_tap', who: 'alien3', event: 'tap', text: 'Помпоны качаются по очереди.' },
    { id: 'kuku_badge_purchase', who: 'alien3', event: 'purchase', text: 'На меху блестит маленькая капелька.' },
    { id: 'kuku_badge_tap', who: 'alien3', event: 'tap', text: 'Блик перекатился на другой бок.' },
    { id: 'room_cloud_seat_purchase', who: 'alien3', event: 'purchase', text: 'У нас теперь облачное кресло!' },
    { id: 'room_cloud_seat_tap', who: 'alien3', event: 'tap', text: 'Подушка помялась и снова круглая.' },
    { id: 'room_star_mobile_purchase', who: 'ori', event: 'purchase', text: 'Три звёздочки устроились рядом.' },
    { id: 'room_star_mobile_tap', who: 'ori', event: 'tap', text: 'Каждая качается по-своему.' },
    { id: 'room_bubble_window_purchase', who: 'alien2', event: 'purchase', text: 'Окошко для пузырьков! Поставим здесь.' },
    { id: 'room_bubble_window_tap', who: 'alien2', event: 'tap', text: 'Три пузырька поднимаются наверх!' },
    { id: 'room_crystal_chime_purchase', who: 'alien1', event: 'purchase', text: 'На стойке три цветных кристалла.' },
    { id: 'room_crystal_chime_tap', who: 'alien1', event: 'tap', text: 'Этот кристалл повернулся ко мне.' },
    { id: 'room_orbit_shelf_purchase', who: 'alien1', event: 'purchase', text: 'Камешки удобно сидят на круглой полке.' },
    { id: 'room_orbit_shelf_tap', who: 'alien1', event: 'tap', text: 'Поворот! Камешки поменялись местами.' },
    { id: 'room_sky_globe_purchase', who: 'ori', event: 'purchase', text: 'Маленькое небо поместилось в шаре.' },
    { id: 'room_sky_globe_tap', who: 'ori', event: 'tap', text: 'Облачка поднялись и тихо опускаются.' },
    { id: 'effect_bubbles_purchase', who: 'alien2', event: 'purchase', text: 'Пузыри переливаются всеми боками!' },
    { id: 'effect_bubbles_tap', who: 'alien2', event: 'tap', text: 'Коснёмся одного? Он станет колечком.' },
    { id: 'effect_comet_trail_purchase', who: 'alien1', event: 'purchase', text: 'Можно рисовать короткий кометный след!' },
    { id: 'effect_comet_trail_tap', who: 'alien1', event: 'tap', text: 'Точки идут за пальцем.' },
    { id: 'effect_petal_swirl_purchase', who: 'alien3', event: 'purchase', text: 'Лепестки лёгкие, почти как мои крылья.' },
    { id: 'effect_petal_swirl_tap', who: 'alien3', event: 'tap', text: 'Один кружок — и плавно вниз.' },
    { id: 'effect_soft_aurora_purchase', who: 'ori', event: 'purchase', text: 'У окна будет лента сияния.' },
    { id: 'effect_soft_aurora_tap', who: 'ori', event: 'tap', text: 'Мятный цвет перетекает в сиреневый.' },
    { id: 'effect_star_ripples_purchase', who: 'alien3', event: 'purchase', text: 'Звёзды умеют расходиться кругами!' },
    { id: 'effect_star_ripples_tap', who: 'alien3', event: 'tap', text: 'От пальца побежали три круга.' },
    { id: 'theme_dawn_purchase', who: 'ori', event: 'purchase', text: 'В каюте поселился тёплый рассвет.' },
    { id: 'theme_dawn_tap', who: 'ori', event: 'tap', text: 'Солнце выглянуло чуть выше.' },
    { id: 'theme_mint_garden_purchase', who: 'alien1', event: 'purchase', text: 'Листья на стенах похожи на маленький сад.' },
    { id: 'theme_mint_garden_tap', who: 'alien1', event: 'tap', text: 'Узор расправил большой лист.' },
    { id: 'theme_coral_bay_purchase', who: 'alien2', event: 'purchase', text: 'У нас за окном тихая бухта!' },
    { id: 'theme_coral_bay_tap', who: 'alien2', event: 'tap', text: 'Волна плывёт вслед за рукой.' },
    { id: 'theme_lavender_night_purchase', who: 'alien3', event: 'purchase', text: 'Сиреневая ночь совсем не страшная.' },
    { id: 'theme_lavender_night_tap', who: 'alien3', event: 'tap', text: 'У луны сегодня другая форма.' },
    { id: 'theme_cloud_harbor_purchase', who: 'alien1', event: 'purchase', text: 'Из окна видно облачную пристань.' },
    { id: 'theme_cloud_harbor_tap', who: 'alien1', event: 'tap', text: 'Кораблик подходит к причалу.' },
    { id: 'theme_amber_library_purchase', who: 'ori', event: 'purchase', text: 'В каюте тепло, как в уютной библиотеке.' },
    { id: 'theme_amber_library_tap', who: 'ori', event: 'tap', text: 'Книга открыла пустые странички.' },
    // 24 общие реплики: восемь событий, по три варианта для явного выбора интерфейсом.
    { id: 'shop_1', who: 'ori', event: 'shop', text: 'Здесь можно выбирать вещи для нашей комнаты.' },
    { id: 'shop_2', who: 'alien1', event: 'shop', text: 'Сначала посмотрим, как всё работает?' },
    { id: 'shop_3', who: 'alien2', event: 'shop', text: 'Можно просто поглядеть. Я люблю разглядывать!' },
    { id: 'insufficient_1', who: 'ori', event: 'insufficient', text: 'Монет пока не хватает. Можно вернуться позже.' },
    { id: 'insufficient_2', who: 'alien3', event: 'insufficient', text: 'Не покупаем сейчас? Давай просто примерим.' },
    { id: 'insufficient_3', who: 'alien1', event: 'insufficient', text: 'Эта вещь останется здесь. Спешить не нужно.' },
    { id: 'try_on_1', who: 'ori', event: 'try_on', text: 'Это примерка. Монеты остаются у тебя.' },
    { id: 'try_on_2', who: 'alien2', event: 'try_on', text: 'Примерю и покручусь. Ну как?' },
    { id: 'try_on_3', who: 'alien3', event: 'try_on', text: 'Можно сравнить, а потом вернуть прежний вид.' },
    { id: 'purchased_1', who: 'ori', event: 'purchased', text: 'Куплено. Вещь сохранена в твоей коллекции.' },
    { id: 'purchased_2', who: 'alien1', event: 'purchased', text: 'Теперь это наше. Поставим в комнате?' },
    { id: 'purchased_3', who: 'alien2', event: 'purchased', text: 'Получилось! Давай попробуем нажать.' },
    { id: 'unequip_1', who: 'ori', event: 'unequip', text: 'Убрали в коллекцию. Вернуть можно бесплатно.' },
    { id: 'unequip_2', who: 'alien1', event: 'unequip', text: 'Побуду без наряда. Костюм тоже мне нравится.' },
    { id: 'unequip_3', who: 'alien3', event: 'unequip', text: 'Сняли. Ничего не потерялось.' },
    { id: 'dream_1', who: 'ori', event: 'dream', text: 'Можно отметить мечту, а потом передумать.' },
    { id: 'dream_2', who: 'alien1', event: 'dream', text: 'Дракончик стоит 250. Будем копить в своём темпе.' },
    { id: 'dream_3', who: 'alien2', event: 'dream', text: 'Мне нравится лисёнок. А что нравится тебе?' },
    { id: 'pet_1', who: 'ori', event: 'pet', text: 'Питомцу не нужны корм и покупки для ухода.' },
    { id: 'pet_2', who: 'alien3', event: 'pet', text: 'Уйдём отдыхать? Питомец никуда не пропадёт.' },
    { id: 'pet_3', who: 'alien2', event: 'pet', text: 'Посмотрим, как он играет?' },
    { id: 'friendship_1', who: 'ori', event: 'friendship', text: 'Мы рады тебе и без покупок.' },
    { id: 'friendship_2', who: 'alien1', event: 'friendship', text: 'Вещи меняются, а мы всё так же друзья.' },
    { id: 'friendship_3', who: 'alien3', event: 'friendship', text: 'Хорошо просто побыть рядом.' }
  ]
};
