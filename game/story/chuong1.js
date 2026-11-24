// =====================================================================================
//  CHƯƠNG 1 — ĐÊM Ở GIẢNG ĐƯỜNG  (CHƯƠNG MẪU — dùng để chạy thử hệ thống, sẽ thay bằng kịch bản thật)
//
//  CÁCH VIẾT 1 CHƯƠNG (sao chép file này rồi sửa):
//    hero      : id nhân vật người chơi điều khiển (xem characters.js / students.js / classmates.js)
//    loadout   : vũ khí lúc bắt đầu (id trong src/weapons.js, đặt tên lại được) + đạn dự trữ
//    start     : phòng + điểm đánh dấu xuất hiện
//    items     : vật phẩm riêng của chương (chìa khóa...). heal: n = đồ hồi máu
//    maps      : các PHÒNG. Mỗi phòng vẽ bằng chữ — xem bảng ký tự ở đầu src/story/storyWorld.js
//                objects: điểm đánh dấu (A-Z, 0-9) -> đối tượng:
//                  door   { to: [phòng, điểm], locked, key, lockText, unlockText, event, label }  cửa (bấm E)
//                  exit   { to, w, h, locked, key, under }   lối đi (bước vào là qua phòng khác) — under: ký tự ô bên dưới
//                  item   { item, n, text, event }           vật phẩm (bấm E nhặt)
//                  ammo   { ammo: "pistol", n }              hộp đạn
//                  weapon { weapon: "gPistol", name, ammo }  vũ khí
//                  note   { title, text }                    tờ giấy / tài liệu để đọc
//                  save   {}                                 điểm LƯU GAME (cuốn nhật ký)
//                  look   { text | event, label }            chỗ để xem xét
//                  npc    { char, event | text, face }       bạn bè đứng trong phòng (bấm E nói chuyện)
//                  zombie { kind: "zWalker" | "zRunner" | "zBloater", aggro, hp, wander }
//                  trigger{ event, w, h, once }              bước vào vùng thì chạy sự kiện
//                  spawn  {}                                 chỉ là chỗ đứng (cho goto / spawn)
//                Mọi đối tượng thêm được điều kiện: if: "cờ" · unless: "cờ" · ifItem: "id" · unlessItem
//                lights: [[cột, hàng, { mode: "on" | "flicker" | "off", r, color }]] — đèn trần
//                dark: 0..1 độ tối · floor / floor2 / wall: vật liệu · onEnter: sự kiện mỗi lần vào phòng
//    events    : các SỰ KIỆN = danh sách lệnh. Lệnh hay dùng (đủ danh sách: cuối src/story/storyRun.js):
//                  ["say", "nhu", "lời thoại"]         — "" = lời dẫn · { name: "Tin nhắn", char: "nhu" }
//                  ["think", "tingo", "suy nghĩ"]      — chữ nghiêng
//                  ["choice", "câu hỏi", { "Có": [...], "Không": [...] }]
//                  ["if", "cờ", [nếu có], [nếu không]] · ["flag", "cờ"] · ["give", "bandage", 2] · ["take", "key"]
//                  ["objective", "mục tiêu mới"] · ["note", "tiêu đề", "nội dung"] · ["title", "TO", "nhỏ"]
//                  ["spawn", "zRunner", "điểm"] · ["npc", "điểm", "id"] · ["goto", "phòng", "điểm"] · ["walk", "điểm"]
//                  ["thunder"] · ["scare"] · ["sfx", "bang"] · ["lights", "flicker"] · ["wait", 0.5] · ["end", {...}]
//    Trong lời thoại: *nghiêng* · **đậm** · [r]chữ đỏ[/r] · \n xuống dòng
// =====================================================================================

export default {
  id: "ch1",
  no: 1,
  title: "Đêm Ở Giảng Đường",
  short: "Chương 1",
  teaser: "Minh Huy ngủ quên trong phòng học tối. Khi tỉnh dậy, ngôi trường đã không còn như trước...",
  sample: true,                       // chương mẫu (chờ kịch bản thật)
  hero: "tingo",                     // Minh Huy
  loadout: { weapons: [{ id: "gBaton", name: "Cán Chổi" }], ammo: { pistol: 0 } },
  zombieHp: 2.4,                      // máu zombie x2.4 so với chế độ Giải Trí
  start: { map: "lop", at: "1" },
  objective: "Tìm đường xuống thư viện tầng 1",

  items: {
    key_gv: { name: "Chìa khóa phòng Giáo Vụ", desc: "Chùm chìa có thẻ nhựa ghi GIÁO VỤ.", icon: "🔑", draw: "key" },
    key_stair: { name: "Chìa khóa cổng cầu thang", desc: "Chìa ổ khóa cửa xếp cầu thang tầng 2.", icon: "🗝", draw: "key" },
  },

  intro: "intro",

  // ===================================================================================
  //  CÁC PHÒNG
  // ===================================================================================
  maps: {
    // ------------------------------------------------------------------ PHÒNG HỌC B.204
    lop: {
      name: "Phòng học B.204", floor: "wood", wall: "plaster", dark: 0.9,
      tiles: [
        "########################",
        "##ww###########ww####ww#",
        "########=====#######A###",
        "#..4.....3.............#",
        "#.......kkk.....p......#",
        "#........5.............#",
        "#..dd.dd..dd.dd..dd.dd.#",
        "#..hh.hh..hh.hh..hh.hh.#",
        "#......................#",
        "#..dd.dd..dd.dd..dd.dd.#",
        "#..hh.hh..hh.1h..hh.hh.#",
        "#......................#",
        "#..dd.dd..dd.dd........#",
        "#..hh.hh..hh.hh2....xxb#",
        "########################",
      ],
      lights: [[6, 5, { mode: "off" }], [17, 5, { mode: "flicker" }], [6, 11, { mode: "off" }], [17, 11, { mode: "off" }]],
      objects: {
        A: { type: "door", to: ["hanhlang", "B"], label: "Ra hành lang" },
        1: { type: "spawn" },
        2: { type: "item", item: "bandage", text: "Trong ba lô ai đó bỏ quên có một cuộn **băng gạc**." },
        3: { type: "look", label: "Xem bảng", text: ["Bảng còn chữ của buổi học tối: *Kiểm tra giữa kỳ — Cấu trúc dữ liệu*.", "Bên dưới có ai viết nguệch ngoạc bằng phấn đỏ: [r]ĐỪNG RA NGOÀI[/r]"] },
        4: { type: "look", label: "Nhìn ra cửa sổ", event: "cuaso" },
        5: { type: "note", title: "Sổ đầu bài", text: "Tiết 1–3: Cấu trúc dữ liệu.\nSĩ số: 33/33.\n\n*Ghi chú của giảng viên, chữ viết vội:*\nPhòng y tế báo có sinh viên sốt cao, mắt đỏ, nổi gân đen, **cắn người**. Đã gọi cấp cứu. Cho lớp về sớm.\n\nAi còn ở lại... khóa cửa." },
      },
    },

    // ------------------------------------------------------------------ HÀNH LANG TẦNG 2
    hanhlang: {
      name: "Hành lang tầng 2", floor: "tile", wall: "hall", dark: 0.92,
      tiles: [
        "##################################################",
        "##ww#########ww######ww###########ww####ww########",
        "######B####nn####C#####nn####D####################",
        "#........p........................v..llllll..////#",
        "#..............................6..7..........////#",
        "#........9...............~..............4...F//E/#",
        "#...........5...........~3~..................////#",
        "#........................~.................xx////#",
        "##################################################",
      ],
      lights: [[8, 4, { mode: "flicker" }], [20, 4, { mode: "off" }], [32, 4, { mode: "flicker", color: "#ffd0a0" }], [44, 4, { mode: "off" }]],
      onEnter: "hanhlang_vao",
      objects: {
        B: { type: "door", to: ["lop", "A"], label: "Vào phòng B.204" },
        C: { type: "door", to: ["wc", "C"], label: "Nhà vệ sinh nam" },
        D: { type: "door", to: ["giaovu", "D"], label: "Phòng Giáo Vụ", locked: true, key: "key_gv",
          lockText: "Cửa phòng Giáo Vụ khóa. Trên cửa dán tờ giấy: *Chìa khóa — liên hệ bảo vệ.*",
          unlockText: "Dùng **Chìa khóa phòng Giáo Vụ** mở cửa. *Cạch.*" },
        E: { type: "exit", to: ["sanh", "S"], w: 2, h: 3, under: "/", locked: true, key: "key_stair",
          lockText: "Cổng xếp cầu thang bị khóa bằng một ổ khóa to tướng.\n*Sổ trực ghi chìa để trong tủ hồ sơ phòng Giáo Vụ.*", unlockText: "Mở ổ khóa cổng xếp bằng **Chìa khóa cổng cầu thang**... Cửa sắt rít lên ken két." },
        F: { type: "spawn" },
        3: { type: "look", label: "Xem xét", event: "baove" },
        4: { type: "zombie", kind: "zWalker" },
        5: { type: "zombie", kind: "zWalker", if: "hanhlang_dot2" },
        6: { type: "zombie", kind: "zRunner", if: "hanhlang_dot2" },
        7: { type: "look", label: "Máy bán nước", event: "maybannuoc" },
        9: { type: "trigger", event: "hanhlang_dau", h: 5 },
      },
    },

    // ------------------------------------------------------------------ NHÀ VỆ SINH NAM
    wc: {
      name: "Nhà vệ sinh nam", floor: "wc", wall: "wcTile", dark: 0.93,
      tiles: [
        "################",
        "##m#m###########",
        "################",
        "#.s.s.uu.t.t.t.#",
        "#..2.....t.tSt.#",
        "#........t.t.t.#",
        "#...........4..#",
        "#..........~...#",
        "#.........~....#",
        "#...........3..#",
        "#..............#",
        "###C############",
      ],
      lights: [[8, 6, { mode: "flicker", color: "#d8f0ff" }]],
      onEnter: "wc_vao",
      objects: {
        C: { type: "door", to: ["hanhlang", "C"], label: "Ra hành lang" },
        2: { type: "item", item: "key_gv", text: "Trên bồn rửa tay có chùm chìa khóa đề **Phòng Giáo Vụ**.", event: "wc_hu" },
        3: { type: "ammo", ammo: "pistol", n: 6, text: "Trong góc có hộp đạn rơi vãi: **6 viên đạn súng lục**." },
        4: { type: "look", label: "Buồng cuối", text: ["Cửa buồng cuối đóng kín. Dưới khe cửa... có một vũng gì đó đen sẫm."], unless: "wc_hu_xong" },
        S: { type: "spawn" },
      },
    },

    // ------------------------------------------------------------------ PHÒNG GIÁO VỤ (an toàn, có điểm lưu)
    giaovu: {
      name: "Phòng Giáo Vụ", floor: "carpet", wall: "office", dark: 0.78, indoorRain: 0.35,
      tiles: [
        "####################",
        "####ww#######ww#####",
        "########n###########",
        "#bbbb..........cccc#",
        "#...............3..#",
        "#..................#",
        "#..kkkk.....kkkk...#",
        "#...1h......h2.....#",
        "#..................#",
        "#..kkkk............#",
        "#.......5........4.#",
        "#p.................#",
        "##########D#########",
      ],
      lights: [[5, 7, { mode: "on", color: "#ffd890", r: 84 }], [14, 6, { mode: "flicker" }]],
      onEnter: "giaovu_vao",
      objects: {
        D: { type: "door", to: ["hanhlang", "D"], label: "Ra hành lang" },
        1: { type: "save" },
        2: { type: "note", title: "THÔNG BÁO KHẨN", text: "Do dịch bệnh lạ bùng phát tại khu ký túc xá, nhà trường yêu cầu toàn bộ sinh viên, cán bộ **ở yên trong phòng, khóa cửa**, không tiếp xúc người có biểu hiện sốt cao, mắt đỏ, hung hăng.\n\nLực lượng chức năng sẽ đến hỗ trợ.\n\n*Bên dưới có ai viết bằng bút đỏ:*\n[r]Không ai đến cả.[/r]" },
        3: { type: "look", label: "Lục tủ hồ sơ", event: "tuhoso" },
        4: { type: "item", item: "medkit", text: "Trên tường có **hộp sơ cứu**." },
        5: { type: "npc", char: "ngan", event: "ngan" },
      },
    },

    // ------------------------------------------------------------------ SẢNH TẦNG 1
    sanh: {
      name: "Sảnh tầng 1", floor: "concrete", floor2: "tile", wall: "hall", dark: 0.94,
      tiles: [
        "##############################",
        "###ww#####ww####ww#####ww#####",
        "#######nn######L#######nn#####",
        "#///.........................#",
        "#U/S.........................#",
        "#///.........................#",
        "#.........9..................#",
        "#.......o............o....6..#",
        "#............................#",
        "#...........kkkkkk...........#",
        "#....4.........~.............#",
        "#.......o............o.......#",
        "#.hh.hh.................5....#",
        "#x...........................#",
        "#xx.........7.......8........#",
        "#############GH###############",
      ],
      lights: [[15, 3, { mode: "on", color: "#ffc870", r: 46, a: 0.7 }], [8, 9, { mode: "flicker" }], [21, 9, { mode: "flicker" }]],
      objects: {
        U: { type: "exit", to: ["hanhlang", "F"], under: "/", h: 3 },
        S: { type: "spawn" },
        L: { type: "door", label: "Gõ cửa thư viện", event: "thuvien" },
        G: { type: "door", locked: true, lockText: "Cửa kính chính bị xích từ bên ngoài.", label: "Cửa chính" },
        H: { type: "door", locked: true, lockText: "Bên kia lớp kính mờ... có những bàn tay đang đập liên hồi.", label: "Cửa chính" },
        4: { type: "zombie", kind: "zWalker" },
        5: { type: "zombie", kind: "zWalker" },
        6: { type: "zombie", kind: "zBloater" },
        7: { type: "look", label: "Xem", text: "Kính cửa nứt toác. Ngoài sân trường, mưa trắng xóa và những bóng người lảo đảo." },
        8: { type: "ammo", ammo: "pistol", n: 8, text: "Dưới gầm ghế có hộp đạn: **8 viên đạn súng lục**." },
        9: { type: "trigger", event: "sanh_vao", h: 5 },
      },
    },
  },

  // ===================================================================================
  //  SỰ KIỆN
  // ===================================================================================
  events: {
    intro: [
      ["fade", "out", 0.01],
      ["title", "ĐÊM Ở GIẢNG ĐƯỜNG", "Chương 1 · bản mẫu", 3.6],
      ["thunder"],
      ["fade", "in", 2],
      ["think", "tingo", "Ưm... mấy giờ rồi..."],
      ["say", "tingo", "Trời đất... ngủ quên trong lớp luôn. Mọi người về hết rồi à?"],
      ["thunder"],
      ["say", "tingo", "Cúp điện à? Mưa to ghê..."],
      ["sfx", "item"],
      ["say", "", "*Điện thoại rung lên. Có 1 tin nhắn chưa đọc.*"],
      ["say", { name: "Tin nhắn — Nhu", char: "nhu" }, "Huy ơi ông đâu rồi??? Trường có chuyện rồi, ĐỪNG ra hành lang!!\nTụi tui đang trốn ở **thư viện tầng 1**"],
      ["say", "tingo", "Chuyện gì mà nghe ghê vậy trời..."],
      ["objective", "Tìm đường xuống thư viện tầng 1"],
      ["banner", "WASD: đi · Chuột: soi đèn pin / ngắm · E: xem, nhặt · Tab: túi đồ", "#c8c0d8"],
    ],
    cuaso: [
      ["say", "", "Mưa trắng trời. Sân trường tối om."],
      ["thunder"],
      ["wait", 0.3],
      ["say", "", "Ánh chớp lóe lên... dưới sân có mấy bóng người đứng giữa mưa."],
      ["think", "tingo", "Họ đang lê từng bước... Sao lại đi kiểu đó?"],
    ],
    hanhlang_vao: [
      ["if", { if: "hanhlang_dot2", unless: "hanhlang_dot2_thay" }, [
        ["flag", "hanhlang_dot2_thay"],
        ["thunder"],
        ["say", "tingo", "Lại thêm mấy đứa nữa... Phải tới được cầu thang cuối hành lang!"],
      ]],
    ],
    hanhlang_dau: [
      ["thunder"],
      ["wait", 0.4],
      ["say", "tingo", "Hành lang tối thui..."],
      ["say", "tingo", "Ở cuối hành lang... hình như có ai đứng đó?"],
      ["say", "tingo", "Ê! Bạn gì ơi!"],
      ["sfx", "growl"],
      ["think", "tingo", "Không trả lời... Có gì đó không ổn."],
      ["banner", "Chuột trái: đánh · Shift: lướt né · R: nạp đạn · Q: đổi vũ khí", "#c8c0d8"],
    ],
    baove: [
      ["if", "co_sung", [["say", "", "Thi thể bác bảo vệ. Không nên nhìn lâu."]], [
        ["sfx", "sting"],
        ["say", "tingo", "Bác... bác bảo vệ?!"],
        ["say", "", "Cổ bác bị cắn nát. Máu vẫn còn ấm."],
        ["think", "tingo", "Cái gì... có thể làm thế này?"],
        ["say", "", "Bên hông bác có một khẩu súng lục và cuốn sổ trực."],
        ["weapon", "gPistol", "Súng lục bảo vệ", 6],
        ["ammo", "pistol", 6],
        ["flag", "co_sung"],
        ["sfx", "item"],
        ["say", "", "Nhặt được **Súng lục** (6 viên trong băng) và **6 viên đạn** dự trữ."],
        ["note", "Sổ trực của bảo vệ", "21:40 — Có tiếng la hét ở nhà vệ sinh nam tầng 2.\n22:05 — Sinh viên cắn người. Đã **khóa cổng cầu thang**, chìa cất trong **tủ hồ sơ phòng Giáo Vụ**.\n22:10 — Để quên chìa phòng Giáo Vụ trong **nhà vệ sinh nam**. Trời ơi.\n22:1"],
        ["objective", "Tìm chìa khóa phòng Giáo Vụ (nhà vệ sinh nam)"],
        ["banner", "Đạn có hạn — bắn cho chắc! Q: đổi sang cán chổi", "#ffe9a8"],
      ]],
    ],
    maybannuoc: [
      ["if", "ca_phe", [["say", "", "Máy bán nước trống trơn."]], [
        ["sfx", "bang"],
        ["say", "tingo", "Đập thử phát xem..."],
        ["give", "coffee"],
        ["flag", "ca_phe"],
        ["say", "", "Một **lon cà phê** lăn ra. *(Hồi 1 máu — dùng trong túi đồ)*"],
      ]],
    ],
    wc_vao: [
      ["if", "!wc_da_vao", [
        ["flag", "wc_da_vao"],
        ["say", "", "Mùi tanh nồng xộc lên mũi."],
        ["think", "tingo", "Có tiếng nước nhỏ giọt... và tiếng gì đó sột soạt trong buồng cuối."],
      ]],
    ],
    wc_hu: [
      ["wait", 0.5],
      ["sfx", "bang"], ["shake", 0.3, 3],
      ["wait", 0.6],
      ["sfx", "bang"], ["shake", 0.3, 4],
      ["think", "tingo", "Cửa buồng cuối... đang rung..."],
      ["wait", 0.5],
      ["scare"],
      ["spawn", "zRunner", "S", { rise: false }],
      ["flag", "wc_hu_xong"],
      ["objective", "Mở phòng Giáo Vụ trên hành lang"],
    ],
    giaovu_vao: [
      ["if", "!giaovu_da_vao", [
        ["flag", "giaovu_da_vao"],
        ["say", "", "Phòng Giáo Vụ vẫn còn một ngọn đèn bàn le lói. Ở đây có vẻ an toàn hơn."],
        ["banner", "Cuốn nhật ký trên bàn: bấm E để LƯU GAME", "#ffd27a"],
      ]],
    ],
    tuhoso: [
      ["if", "co_chia_cau_thang", [["say", "", "Tủ hồ sơ chỉ còn giấy tờ ẩm mốc."]], [
        ["sfx", "page"],
        ["say", "", "Ngăn kéo thứ hai... dưới xấp hồ sơ là một chiếc chìa khóa có dán băng keo: **CẦU THANG T2**."],
        ["give", "key_stair"],
        ["flag", "co_chia_cau_thang"],
        ["flag", "hanhlang_dot2"],
        ["thunder"],
        ["wait", 0.3],
        ["sfx", "growl"],
        ["think", "tingo", "...Tiếng gì ngoài hành lang vậy?"],
        ["objective", "Mở cổng cầu thang cuối hành lang"],
      ]],
    ],
    ngan: [
      ["if", "noi_ngan", [["say", "ngan", "Tui ở đây chờ. Ông đi cẩn thận nha..."]], [
        ["flag", "noi_ngan"],
        ["say", "ngan", "Á!! ...Ơ, Huy hả? Hết hồn."],
        ["say", "tingo", "Ngân? Sao bà ở đây?"],
        ["say", "ngan", "Tui lên nộp bài thì... thì có người cắn bác bảo vệ. Bác đẩy tui vô đây rồi khóa cửa bên ngoài."],
        ["say", "ngan", "Bác nói đi tìm người giúp... rồi không thấy quay lại nữa."],
        ["say", "tingo", "..."],
        ["say", "ngan", "Chân tui run quá, không đi nổi. Ông cầm cái này đi."],
        ["give", "bandage", 2],
        ["say", "", "Ngân đưa cho **2 cuộn băng gạc**."],
        ["say", "tingo", "Bà ở yên đây, khóa cửa lại. Tui xuống thư viện tìm mọi người rồi quay lại đón bà."],
        ["say", "ngan", "Cổng cầu thang bị khóa đó. Bác bảo vệ hay cất chìa trong **tủ hồ sơ** góc phòng này."],
        ["if", "!co_chia_cau_thang", [["objective", "Lục tủ hồ sơ tìm chìa khóa cầu thang"]]],
      ]],
    ],
    sanh_vao: [
      ["say", "tingo", "Sảnh tầng 1..."],
      ["thunder"],
      ["say", "tingo", "Thư viện ở phía trên kia. Có ánh đèn hắt ra dưới khe cửa!"],
      ["objective", "Vào thư viện"],
    ],
    thuvien: [
      ["sfx", "bang"],
      ["say", "tingo", "*Cốc cốc cốc!*"],
      ["wait", 0.6],
      ["say", "nhu", "A... ai đó?!"],
      ["say", "tingo", "Tui nè! Minh Huy đây!"],
      ["say", "trung", "Huy hả? Có bị cắn không?"],
      ["say", "tingo", "Không! Mở cửa lẹ đi, ngoài này nhiều... mấy cái thứ đó lắm!"],
      ["sfx", "door"],
      ["say", "nhu", "Vào nhanh!!"],
      ["fade", "out", 1.2],
      ["end", { title: "HẾT CHƯƠNG MẪU", kicker: "Chương 1 · Đêm ở giảng đường", text: "Minh Huy đã tới được thư viện, nơi Nhu, Trung và những người còn lại đang trốn.\n\n*Đây là chương mẫu để chạy thử hệ thống — kịch bản chính thức sẽ được cập nhật.*" }],
    ],
  },
};
