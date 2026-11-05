/* Content + coordinates for the SALA master plan map.
   All x/y are in each map's own coordinate space (design px of the Figma map component).
   Items marked `data: null` have no content in the Figma file yet — the panel shows
   "Thông tin đang được cập nhật" for them. Fill in real content here. */
window.SALA_DATA = {
  titles: {
    overview: ['SALA - Tâm điểm kết nối', 'TOD tại Thủ Thiêm'],
    urban: ['Dòng chảy kết nối', 'Trải nghiệm nâng tầm']
  },
  description: 'Là tâm điểm tài chính - văn hóa mới, Thủ Thiêm đang bứt phá mạnh mẽ nhờ hạ tầng chiến lược và mạng lưới Metro TOD. Trong bức tranh đó, Khu đô thị Sala dần hoàn thiện hệ sinh thái đa kết nối, thiết lập chuẩn mực phát triển bền vững cho toàn khu vực.',

  /* Overview (location) map: Sala zone + pin */
  overview: {
    zone: { x: 684.6, y: 760.2, w: 186.5, h: 175 },
    pin: { x: 767, y: 840 }
  },

  /* Overview (location) map: the brown arterial roads, traced from map-tong.jpg and
     converted to overview map space (image drawn at 0.91704× from y = 183). */
  overviewRoads: [
    { id: 'vvk-mct', name: 'Võ Văn Kiệt – Mai Chí Thọ', dur: 9,
      d: 'M 4.2 1133.6 C 9.3 1134.6 24.7 1137.3 34.9 1139.5 C 45.1 1141.7 55.2 1144.9 65.4 1146.8 C 75.6 1148.7 86.8 1152.5 96.3 1151.1 C 105.8 1149.7 114.7 1144.2 122.7 1138.4 C 130.7 1132.7 135.6 1120.8 144.3 1116.6 C 153.0 1112.3 164.8 1112.9 175.1 1112.9 C 185.4 1112.9 195.8 1115.2 206.1 1116.4 C 216.4 1117.6 228.0 1122.8 236.9 1120.0 C 245.8 1117.2 252.5 1107.0 259.6 1099.6 C 266.7 1092.2 272.5 1083.1 279.6 1075.6 C 286.8 1068.0 294.5 1061.0 302.5 1054.3 C 310.5 1047.6 319.1 1041.6 327.6 1035.6 C 336.1 1029.5 345.2 1024.3 353.5 1018.0 C 361.8 1011.7 369.9 1005.0 377.2 997.6 C 384.5 990.2 389.9 981.0 397.1 973.5 C 404.3 966.0 412.3 959.2 420.3 952.5 C 428.3 945.8 437.6 940.6 445.1 933.5 C 452.6 926.4 457.5 916.1 465.5 909.9 C 473.5 903.7 483.5 899.6 493.2 896.2 C 502.9 892.8 513.5 891.6 523.7 889.6 C 533.9 887.6 544.3 886.0 554.6 884.2 C 564.9 882.4 575.1 880.8 585.4 878.9 C 595.7 877.0 606.0 875.3 616.2 873.1 C 626.4 870.9 636.5 868.5 646.6 865.8 C 656.7 863.1 666.7 860.2 676.6 857.0 C 686.5 853.8 696.3 850.0 706.1 846.5 C 715.9 843.0 726.0 840.4 735.4 836.0 C 744.8 831.6 753.2 825.1 762.5 820.4 C 771.8 815.7 781.8 812.6 790.9 807.7 C 800.0 802.8 808.0 796.1 817.1 791.0 C 826.2 785.9 835.9 781.9 845.2 777.1 C 854.5 772.3 863.6 767.3 872.8 762.4 C 882.0 757.5 891.3 752.8 900.5 747.9 C 909.7 743.0 918.9 737.9 928.1 733.1 C 937.4 728.3 946.8 723.8 956.0 718.9 C 965.2 714.0 974.3 708.8 983.5 703.9 C 992.7 699.0 1002.0 694.2 1011.2 689.4 C 1020.4 684.5 1029.7 679.7 1038.9 674.8 C 1048.1 669.9 1058.1 665.9 1066.5 660.0 C 1074.9 654.1 1083.6 647.8 1089.1 639.5 C 1094.6 631.2 1096.7 620.0 1099.3 610.0 C 1101.9 600.0 1103.0 589.5 1104.8 579.2 C 1106.6 568.9 1108.4 558.7 1110.2 548.4 C 1112.0 538.1 1113.8 527.9 1115.6 517.6 C 1117.4 507.3 1119.2 497.1 1121.1 486.8 C 1123.0 476.5 1124.5 466.2 1126.8 456.0 C 1129.0 445.8 1131.5 435.8 1134.6 425.8 C 1137.7 415.9 1143.4 401.2 1145.2 396.3' },
    { id: 'nhc-xlhn', name: 'Nguyễn Hữu Cảnh', dur: 8,
      d: 'M 511.0 886.7 C 512.2 881.5 516.4 866.0 518.3 855.5 C 520.2 845.0 520.9 834.3 522.3 823.7 C 523.7 813.1 525.8 802.6 526.9 792.0 C 528.0 781.4 530.2 770.6 529.2 760.2 C 528.2 749.8 520.9 739.9 521.0 729.8 C 521.1 719.6 525.2 708.7 529.7 699.3 C 534.2 689.9 542.8 682.4 548.2 673.2 C 553.6 664.0 556.0 652.8 562.0 644.3 C 568.0 635.8 575.1 625.0 584.0 622.3 C 592.9 619.6 604.9 627.6 615.3 627.9 C 625.7 628.2 637.5 628.1 646.5 623.9 C 655.5 619.7 664.6 611.3 669.4 602.5 C 674.2 593.7 673.8 581.7 675.3 571.2 C 676.8 560.7 674.3 548.5 678.7 539.6 C 683.1 530.7 693.0 523.0 701.9 517.8 C 710.8 512.6 721.9 510.8 732.2 508.3 C 742.5 505.8 753.3 504.6 763.8 502.7 C 774.3 500.8 784.8 498.6 795.3 496.7 C 805.8 494.8 816.4 492.9 826.9 491.0 C 837.4 489.1 847.9 487.1 858.4 485.1 C 868.9 483.1 879.4 481.1 889.9 479.2 C 900.4 477.2 910.9 475.3 921.4 473.4 C 931.9 471.5 942.5 469.6 953.0 467.6 C 963.5 465.6 973.9 463.4 984.4 461.5 C 994.9 459.6 1005.5 457.8 1016.0 455.9 C 1026.5 454.0 1037.1 452.6 1047.5 450.1 C 1057.9 447.6 1068.2 444.7 1078.2 440.9 C 1088.2 437.1 1098.1 432.6 1107.2 427.2 C 1116.3 421.8 1125.6 415.8 1133.1 408.4 C 1140.6 401.0 1146.9 392.2 1152.1 383.0 C 1157.2 373.8 1160.5 363.3 1164.0 353.2 C 1167.5 343.1 1170.8 332.9 1173.0 322.5 C 1175.2 312.1 1176.1 301.3 1177.2 290.7 C 1178.3 280.1 1179.3 264.1 1179.7 258.8' },
    { id: 'cao-toc', name: 'Cao tốc Long Thành – Dầu Giây', dur: 5,
      d: 'M 1108.3 573.3 C 1113.5 573.5 1129.1 575.8 1139.4 574.8 C 1149.7 573.8 1159.8 569.7 1170.1 567.2 C 1180.3 564.7 1190.6 562.1 1200.9 559.7 C 1211.2 557.3 1221.5 555.0 1231.8 552.8 C 1242.1 550.6 1252.4 548.5 1262.8 546.5 C 1273.2 544.5 1283.6 542.5 1294.0 540.8 C 1304.4 539.1 1314.8 537.3 1325.3 536.2 C 1335.8 535.1 1346.4 534.6 1356.9 534.2 C 1367.5 533.8 1378.0 534.1 1388.6 534.0 C 1399.1 533.9 1409.7 533.3 1420.2 533.3 C 1430.8 533.3 1441.3 533.6 1451.9 533.8 C 1462.5 533.9 1473.0 534.1 1483.6 534.2 C 1494.2 534.3 1504.8 534.1 1515.3 534.2 C 1525.8 534.3 1536.4 534.7 1546.9 535.0 C 1557.5 535.3 1568.0 535.7 1578.6 536.1 C 1589.1 536.5 1599.7 537.0 1610.2 537.3 C 1620.7 537.6 1636.5 537.6 1641.8 537.7' },
    { id: 'do-xuan-hop', name: 'Đỗ Xuân Hợp', dur: 4,
      d: 'M 1385.1 188.2 C 1386.4 193.4 1390.5 208.8 1393.2 219.2 C 1396.0 229.5 1398.8 240.0 1401.6 250.3 C 1404.4 260.7 1407.1 271.0 1410.0 281.3 C 1412.9 291.6 1416.0 301.8 1418.9 312.1 C 1421.8 322.4 1424.4 332.8 1427.2 343.1 C 1430.0 353.4 1433.1 363.8 1436.0 374.1 C 1438.9 384.4 1441.8 394.7 1444.6 405.0 C 1447.4 415.3 1450.2 425.7 1453.1 436.0 C 1455.9 446.3 1458.9 456.7 1461.7 467.0 C 1464.5 477.3 1467.3 487.6 1470.0 498.0 C 1472.7 508.4 1476.7 523.9 1478.0 529.1' }
  ],

  /* Metro alignments traced from the dashes printed on the v8.4 overview artwork (each dash found by colour
     and shape, then joined in order; v8.6). They share the road hover/tap interaction and keep a visible
     dashed route at rest. Metro 1: Bến Thành → Ba Son → Landmark 81 → Xa lộ Hà Nội. Metro 2: Bến Thành → Thủ Thiêm. */
  /* Overview: named areas that light up on hover (v9.3). Outline traced from the gold block printed on the
     v8.4 artwork (colour fill, spurs from the bridge symbols opened away), in map space. */
  overviewAreas: [
    { id: 'tthc', name: 'Trung tâm hành chính - tài chính mới TP.HCM',
      d: 'M 723.5 764.1 L 723.1 761.6 L 703.1 723.0 L 702.7 719.4 L 700.2 717.2 L 686.4 689.2 L 684.2 688.1 L 638.7 698.6 L 622.3 705.9 L 606.0 716.8 L 599.1 723.4 L 598.7 726.3 L 600.9 729.5 L 600.9 732.8 L 594.3 732.8 L 591.0 734.3 L 582.3 750.3 L 579.4 752.8 L 580.5 755.7 L 588.1 760.8 L 595.0 763.0 L 626.3 779.8 L 627.8 781.9 L 633.6 783.0 L 642.3 788.5 L 660.5 797.2 L 663.1 796.1 L 670.4 787.0 L 682.4 778.7 L 699.8 771.4 L 722.4 765.6 Z' }
  ],

  overviewTransit: [
    { id: 'metro-1', kind: 'metro', name: 'Metro 1', color: '#765038', dash: '7 13', dur: 7,
      light: { color: '#d99a5e', core: '#fbe1c2' }, tagRgb: '118, 80, 56',   /* hover: copper glow + brown pill, like its dashes */
      x1: 387.1, y1: 876.1, x2: 1135.8, y2: 392.3,
      d: 'M 387.1 876.1 L 394.9 871.4 L 461.8 813.3 L 480.5 794.4 L 532.3 736.3 L 584.7 679.5 L 592.9 656.5 L 612.0 568.5 L 640.1 542.4 L 680.0 510.0 L 704.6 502.7 L 969.1 455.0 L 1031.8 443.0 L 1069.9 432.1 L 1094.6 421.9 L 1105.2 416.7 L 1116.6 409.5 L 1126.8 401.7 L 1135.8 392.3' },
    { id: 'metro-2', kind: 'metro', name: 'Metro 2', color: '#556b2f', dash: '7 13', dur: 8,
      light: { color: '#8fc256', core: '#e6f6cf' }, tagRgb: '78, 110, 44',   /* hover: green glow + green pill, like its dashes */
      x1: 387.1, y1: 876.1, x2: 1064.2, y2: 650.4,
      d: 'M 387.1 876.1 L 399.3 881.1 L 475.0 888.4 L 498.6 888.4 L 549.2 876.4 L 648.7 856.3 L 675.1 849.9 L 699.3 842.5 L 733.1 826.1 L 824.8 778.5 L 1064.2 650.4' }
  ],

  /* 3D master map: project labels. side = which side of the leader line the label sits */
  /* 3D master map: project labels (v9.0, Figma "WEBSITE KHU ĐÔ THỊ SALA" 28407:14051).
     x, y = foot of the flag pole on the building, in map space (Figma Map x1648/1471, the Map sits at x -16).
     status = sales status shown in the panel header (Hyun 05/11): open = Đang mở bán (Sarene, Saroma Villas), soon = Sắp mở bán (Sadora, Savila), closed = Chưa mở bán (the rest).
     thumb = popover picture for a project without content yet (v9.9: a 16:9 crop of the 3D render around its outline).
     side = which side of the pole the tag sits; pole = pole length relative to the others (Figma: 70 / 120 px). */
  projects: [
    { id: 'sarene-residence', name: 'Sarene', x: 1129.3, y: 433.6, side: 'right', status: 'open',
      data: {
        title: 'Sarene',
        image: 'assets/img/sarene/01.webp',
        desc: 'Dự án thuộc tổ hợp căn hộ cao cấp và phố thương mại thuộc Hệ sinh thái Sala Phân khu Bắc',
        /* stats: [label, value] — label left, value right for every popover (feedback 02/11) */
        stats: [['Diện tích khu đất', '16.319 m²'], ['Tháp căn hộ', '04'], ['Tổng số căn hộ', '441 căn'], ['Shop Apartment', '60 căn']],
        /* renders from the client (02/11): full size opens in the viewer, small copies in the strip */
        gallery: [{ src: 'assets/img/sarene/01.webp', thumb: 'assets/img/sarene/01-t.webp' }, { src: 'assets/img/sarene/02.webp', thumb: 'assets/img/sarene/02-t.webp' }, { src: 'assets/img/sarene/03.webp', thumb: 'assets/img/sarene/03-t.webp' }, { src: 'assets/img/sarene/04.webp', thumb: 'assets/img/sarene/04-t.webp' }, { src: 'assets/img/sarene/05.webp', thumb: 'assets/img/sarene/05-t.webp' }, { src: 'assets/img/sarene/06.webp', thumb: 'assets/img/sarene/06-t.webp' }, { src: 'assets/img/sarene/07.webp', thumb: 'assets/img/sarene/07-t.webp' }, { src: 'assets/img/sarene/08.webp', thumb: 'assets/img/sarene/08-t.webp' }, { src: 'assets/img/sarene/09.webp', thumb: 'assets/img/sarene/09-t.webp' }, { src: 'assets/img/sarene/10.webp', thumb: 'assets/img/sarene/10-t.webp' }, { src: 'assets/img/sarene/11.webp', thumb: 'assets/img/sarene/11-t.webp' }, { src: 'assets/img/sarene/12.webp', thumb: 'assets/img/sarene/12-t.webp' }],
        cta: 'Xem chi tiết dự án', href: '#'
      } },
    { id: 'sadora', name: 'Sadora', x: 1038.5, y: 360.7, side: 'right', status: 'soon', thumb: 'assets/img/projects/sadora.webp', data: null },
    { id: 'saroma-villas', name: 'Saroma Villas', x: 572.5, y: 299.1, side: 'right', status: 'open', thumb: 'assets/img/projects/saroma-villas.webp', data: null },
    { id: 'sarimi', name: 'Sarimi', x: 729.3, y: 351.8, side: 'right', status: 'closed', thumb: 'assets/img/projects/sarimi.webp', data: null },
    { id: 'sarica', name: 'Sarica', x: 607.2, y: 400, side: 'right', status: 'closed', thumb: 'assets/img/projects/sarica.webp', data: null },
    { id: 'nha-pho-thuong-mai', name: 'Nhà phố thương mại', x: 528.8, y: 370.8, side: 'left', status: 'closed', thumb: 'assets/img/projects/nha-pho-thuong-mai.webp', data: null },
    { id: 'saritown', name: 'Saritown', x: 796.6, y: 441.4, side: 'right', status: 'closed', thumb: 'assets/img/projects/saritown.webp', data: null },
    { id: 'sarina', name: 'Sarina', x: 868.3, y: 441.4, side: 'right', pole: 0.6, status: 'closed', thumb: 'assets/img/projects/sarina.webp', data: null },
    { id: 'commercial-villas', name: 'Commercial Villas', x: 705.8, y: 478.4, side: 'left', pole: 0.583, status: 'closed', thumb: 'assets/img/projects/commercial-villas.webp', data: null },
    { id: 'savila', name: 'Savila', x: 1011.7, y: 664.4, side: 'right', status: 'soon', thumb: 'assets/img/projects/savila.webp', data: null },
    { id: 'mansion', name: 'Mansion', x: 913.1, y: 652, side: 'left', pole: 0.583, status: 'closed', thumb: 'assets/img/projects/mansion.webp', data: null }
  ],

  /* 3D master map: landmarks (v9.4, Figma 28407:14051 "Web/Map/Road Tag" + Vector 2412). Always-visible gold road-tag
     label (pill + leader + dot, dot at x, y); hovering the label or the outline lights the outline like a project.
     No popover (no content). The outline is projectZones[zone]. */
  landmarks: [
    { id: 'tthc-3d', name: 'Trung tâm Hành chính TP.HCM', x: 906.3, y: 168, zone: 'tthc-3d' }   /* v10.5: anchor moved down onto the middle of the block (Figma 138.9) */
  ],

  /* 3D master map: building outlines (v9.0): the Figma vectors behind each label in 28407:14051, converted to map space
     (x1648/1471 from the Map instance). Each outline keeps its own Figma fill / stroke gradient:
     fill/stroke = [x1, y1, x2, y2] in map space; stops = [offset, colour(, opacity)]. Strokes render at 1 px (sw 0.64).
     Sarene 2392, Sadora 2401, Saroma Villas 2408, Sarimi 2405, Sarica 2406, Nha pho thuong mai = Group 2147223721,
     Saritown 2404, Sarina 2402, Savila 2403, Commercial Villas 2409, Mansion 2410. */
  projectZones: {
    'sarene-residence': [
      { fill: [1103.5, 354.8, 1103.5, 484.3], fillStops: [[0, "#BC8E49"], [1, "#564121"]], stroke: [1125.3, 390.8, 1098.3, 480.3], strokeStops: [[0, "#E1CFA6"], [1, "#7B715B", 0]], sw: 0.64,
        d: 'M 1060.3 362.8 L 1042.8 366.8 L 1046.3 371.8 L 1044.8 391.3 L 1057.3 387.3 L 1064.8 390.3 L 1076.3 403.3 L 1070.3 469.3 L 1075.3 475.3 L 1077.3 463.3 L 1087.3 460.8 V 459.3 L 1099.3 456.3 L 1107.8 466.3 V 469.3 L 1113.8 476.8 H 1117.8 L 1125.3 484.3 H 1127.3 L 1130.3 457.3 L 1138.8 454.8 L 1156.3 471.8 C 1164.7 469.4 1162.5 457.1 1160.3 451.3 L 1163.8 423.3 C 1165.8 414.1 1159.7 406.1 1156.3 403.3 L 1147.3 406.8 L 1144.8 423.3 L 1138.8 424.3 L 1137.3 432.3 L 1128.8 434.8 L 1132.3 403.3 L 1125.3 397.3 L 1112.3 401.8 L 1113.8 383.8 L 1107.8 378.3 V 367.8 L 1095.3 354.8 L 1076.3 360.3 L 1072.3 387.3 L 1063.8 389.3 L 1065.8 367.8 L 1060.3 362.8 Z' }
    ],
    'sadora': [
      { fill: [1026.3, 315.6, 1036.4, 379.3], fillStops: [[0, "#BC8E49"], [1, "#564121"]], stroke: [1033.6, 321.7, 1054.3, 369.1], strokeStops: [[0, "#E1CFA6"], [1, "#7B715B", 0]], sw: 0.64,
        d: 'M 1004.6 327.4 L 1003.3 339.5 L 1012.9 349.4 V 359.9 L 1029.4 356.4 L 1035.2 358 L 1043.1 366.3 L 1060.7 362.8 L 1065.8 367.5 L 1064.8 379.3 H 1065.8 L 1069.6 340.1 H 1062.9 L 1059.6 344 L 1058 343 L 1058.1 342.8 L 1056.8 342.1 L 1053.3 348.4 L 1052.4 351 L 1053.6 331.8 L 1047.9 330.3 V 327.4 L 1048.6 325.8 L 1012.9 315.3 L 1008.7 320.1 L 1009.7 321 L 1004.6 327.4 Z' }
    ],
    'saroma-villas': [
      { fill: [590.7, 244.1, 612.9, 354], fillStops: [[0, "#BC8E49"], [1, "#564121"]], stroke: [605.3, 254, 624.2, 301.3], strokeStops: [[0, "#E1CFA6"], [1, "#E1CFA6", 0]], sw: 0.64,
        d: 'M 622.8 343.5 L 447 379.2 C 445.7 379.7 443.2 372.5 456.2 347 C 476 308.5 507.6 288.6 538.1 273.8 C 576 255.3 616.1 246.7 643.5 243.8 C 670.9 241 693.9 241.3 719.3 247 C 738.3 251.3 752.2 261.2 757.7 266.6 C 758.3 267.1 758.1 268 757.4 268.4 L 750.5 271.5 C 748.4 272.5 745.9 272.3 743.9 271 L 742.4 269.9 C 740.3 268.6 737.7 268.4 735.5 269.5 L 715.9 279.4 C 713.8 280.5 711.4 280.6 709.3 279.7 L 708.9 279.5 C 702.4 276.8 695.3 276 688.4 277.2 L 682.9 278.1 C 675.1 279.4 667.9 283.1 662.3 288.7 L 661.4 289.7 L 659.3 291.5 C 656.1 294.3 652.2 296.2 648 297 L 633.3 298 L 612.5 300.8 C 608.8 301.5 606.6 305.5 608.1 309 L 622.8 343.5 Z' }
    ],
    'sarimi': [
      { fill: [730.4, 321.4, 734.5, 366.3], fillStops: [[0, "#BC8E49"], [1, "#564121"]], stroke: [751.4, 321, 756.7, 359], strokeStops: [[0, "#E1CFA6"], [1, "#E1CFA6", 0]], sw: 0.64,
        d: 'M 646.3 382.5 L 639.3 367.5 C 638.5 365.5 641.1 362.9 642.5 361.8 V 360.9 C 642.5 359.6 643.5 358.6 644.7 358.6 H 645.7 V 348.7 L 645 347.8 V 343.3 L 653 341.7 L 657.4 348.7 L 675.3 341.7 L 682.3 346.8 V 351 L 687.4 350.3 V 337 L 713.8 330 L 718.9 335.4 V 347.8 C 725 347.6 730.8 344.9 734.8 340.3 L 735.5 339.5 V 324.9 L 761.9 321.4 L 765.7 327.1 V 334.7 L 775 332.2 V 322 H 777.2 L 777.5 320.1 L 792.2 319.1 V 312.3 L 792.8 312.1 L 802.1 310.8 L 804.6 315.6 L 807.8 316.3 L 809.1 326.4 V 336 L 815.7 347.5 C 817.2 349.2 817.1 352.4 804.6 351.6 C 789 350.7 754 353.8 743.8 356.4 L 721.8 360.8 C 698.9 365.3 666.7 380.9 658.1 384.4 C 651.2 387.2 647.4 384.3 646.3 382.5 Z' }
    ],
    'sarica': [
      { fill: [567.9, 372.9, 573.4, 412.1], fillStops: [[0, "#BC8E49"], [1, "#564121"]], stroke: [629.7, 366.3, 634.3, 411.7], strokeStops: [[0, "#E1CFA6"], [1, "#E1CFA6", 0]], sw: 0.64,
        d: 'M 538 415.9 C 505.4 414.9 498.3 403.4 498.8 397.8 C 500.1 392.9 508.5 391.3 512.5 391.1 V 386.3 C 514.8 386.1 519.4 383.7 521.4 382.5 C 521.9 381 525 381.9 526.5 382.5 C 531.1 382 531.8 383.4 531.6 384.1 L 539.6 382.2 L 539.9 385 L 547.6 383.5 L 547.9 381.2 L 555.8 380 L 556.2 381.9 L 565.1 380 V 375.2 L 572.7 373.9 L 575.3 381.9 L 577.2 383.1 L 577.5 389 L 588.6 386 V 385 V 370.7 L 598.2 368.8 L 599.2 372.6 L 608.1 371 L 607.8 369.8 L 615.1 368.2 L 615.4 369.1 L 624 367.2 L 622.7 363.1 L 632 361.2 L 636.1 370.4 V 373.3 C 637.1 376.7 639.6 384.2 642.2 387 C 644.7 389.8 642.4 391.7 640.9 392.4 L 625.3 397.8 L 538 415.9 Z' }
    ],
    'nha-pho-thuong-mai': [
      { fill: [756.5, 308.3, 756.5, 335.8], fillStops: [[0, "#BC8E49"], [1, "#564121"]], stroke: [696.9, 330.1, 700.2, 360.8], strokeStops: [[0, "#E1CFA6"], [1, "#E1CFA6", 0]], sw: 0.64,
        d: 'M 790.6 308.3 L 793.1 311.8 L 792.5 312.4 V 319.1 L 777.5 320.1 V 322.3 H 775 V 327.1 L 765.7 329 V 327.1 L 761.9 321.4 L 735.5 324.9 V 335 L 730.4 335.7 C 725 336.7 721.1 332.5 719.8 330.3 V 322.6 L 790.6 308.3 Z' },
      { fill: [501.7, 378.2, 624, 378.2], fillStops: [[0, "#BC8E49"], [1, "#564121"]], stroke: [696.9, 330.1, 700.2, 360.8], strokeStops: [[0, "#E1CFA6"], [1, "#E1CFA6", 0]], sw: 0.64,
        d: 'M 501.7 387 L 523.6 380 L 526.2 382.5 C 528.1 382.3 531.9 382.3 531.6 384.1 L 535 383.4 L 539.6 382.2 L 539.6 382.6 L 539.9 383.1 L 564.8 376.8 L 564.7 375.5 L 565 375.4 V 375.2 L 572.7 373.9 L 572.7 374 L 573 373.9 L 573.3 374.8 L 588.3 371.4 L 588.3 371 L 588.6 371 V 370.7 L 598.2 368.8 V 369.2 L 598.5 369.1 L 598.6 369.4 L 623 363.4 L 624 367.2 L 615.4 369.4 L 614.7 368.2 L 607.7 369.8 L 608 371 L 599.4 372.6 L 598.6 369.4 L 598.2 369.4 V 369.2 L 588.6 371 V 371.4 L 588.3 371.4 L 588.6 385.7 L 577.5 389.2 L 577.2 383.1 L 575.2 381.9 L 573.3 374.8 L 573 374.9 L 572.7 374 L 565 375.4 V 376.8 L 564.8 376.8 L 565 380 L 556.4 381.9 L 555.8 380 L 547.8 381.2 L 547.5 383.5 L 539.9 385.4 L 539.6 382.6 L 539.6 382.5 L 535 383.4 L 531.3 384.4 C 531.6 383.5 531 381.8 526.2 382.8 C 524.9 382 522.2 380.7 521.4 382.5 C 519 383.9 513.8 386.6 512.5 386.3 V 391.1 C 511 391.2 507.1 391.7 503.6 393 L 501.7 387 Z' },
      { fill: [573.7, 350, 579.4, 374.9], fillStops: [[0, "#BC8E49"], [1, "#564121"]], stroke: [696.9, 330.1, 700.2, 360.8], strokeStops: [[0, "#E1CFA6"], [1, "#E1CFA6", 0]], sw: 0.64,
        d: 'M 619.3 359.6 L 451.7 394.6 C 446.4 395.4 444.6 393.6 444.4 392.7 L 444.1 384.4 C 443.6 381.1 446.2 379.2 447.6 378.7 L 633.6 340.5 L 706.9 325.5 L 707.8 330.9 L 687.1 336.3 V 344.9 L 682 346.2 L 675 341.1 L 657.2 348.1 L 652.7 341.1 L 644.7 342.7 V 347.2 L 645.4 348.1 V 353.5 L 619.3 359.6 Z' }
    ],
    'saritown': [
      { fill: [846.3, 430.9, 789.9, 466.3], fillStops: [[0, "#BC8E49"], [0.167, "#564121"], [0.275, "#BC8E49"], [0.395, "#564121"], [0.592, "#BC8E49"], [1, "#564121"]], stroke: [881, 490.3, 849.5, 516.6], strokeStops: [[0, "#E1CFA6"], [1, "#E1CFA6", 0]], sw: 0.64,
        d: 'M 803.3 480.9 L 756.2 398.4 C 756.2 395.4 759.3 393.3 760.9 392.7 V 387.3 C 760.9 386.7 761.3 386.3 761.9 386.2 L 781.1 383.6 C 781.6 383.5 782.1 383.8 782.3 384.3 L 785.1 392.1 L 789.9 392.7 C 789.7 389.9 792.1 388.8 793.4 388.6 V 383.3 C 793.4 382.7 793.9 382.2 794.6 382.2 L 805.5 382.5 L 816.9 382.8 C 817.3 382.8 817.7 383.1 817.9 383.6 L 820.8 392.1 L 881 485.7 L 881 491.7 C 883.2 491.4 885.4 492.4 886.5 494.3 L 887.4 495.6 L 936.1 571.4 L 935.5 580.9 L 925.9 583.8 L 895.3 541.1 V 535.7 L 876.2 505.1 C 875.4 504.1 875 502.8 875 501.5 V 497.2 L 870.9 499.1 C 869.2 499.9 866 501 864 501.3 C 857.6 502.3 853.6 497.7 850.1 492.2 L 849.8 491.7 L 844.7 484.1 L 843.1 488.3 C 842.3 490.5 840.7 492.4 838.7 493.5 C 836.4 494.4 833.9 494.5 831.6 493.7 L 831 493.5 L 810.9 486.6 C 806.6 486.1 804 482.6 803.3 480.9 Z' }
    ],
    'commercial-villas': [
      { fill: [733.8, 395.5, 735.3, 533.1], fillStops: [[0, "#BC8E49"], [1, "#564121"]], stroke: [759.3, 429.3, 777.2, 469.5], strokeStops: [[0, "#E1CFA6"], [1, "#E1CFA6", 0]], sw: 0.64,
        d: 'M 705.8 515.3 L 663.2 422.4 C 661 415.2 669 413.4 673.3 413.4 L 672.8 410.6 L 681.2 408.4 L 682.3 411.7 L 685.1 410.6 V 407.2 L 695.7 405 L 696.3 406.7 C 699 406.2 701.5 409.9 702.4 411.7 L 756.8 517 C 758.6 519.7 757.5 522.6 756.8 523.8 L 752.3 527.7 C 749.6 530.4 743 529.5 740 528.8 L 713.6 521 C 708.3 520.1 706.2 516.8 705.8 515.3 Z' },
      { fill: [733.8, 395.5, 735.3, 533.1], fillStops: [[0, "#BC8E49"], [1, "#564121"]], stroke: [759.3, 429.3, 777.2, 469.5], strokeStops: [[0, "#E1CFA6"], [1, "#E1CFA6", 0]], sw: 0.64,
        d: 'M 711.4 413.4 C 707.8 406.2 712.5 404.1 715.3 403.9 V 401.6 L 727.7 398.8 L 728.8 401.1 H 731.6 V 397.7 L 741.1 395.5 L 742.2 397.2 C 745.8 396.3 748.6 399.4 749.5 401.1 L 794.9 481.7 C 797.1 485.8 795.4 488.3 794.3 489 L 771.3 510.3 C 766.4 515.2 762.6 512.7 761.3 510.9 L 711.4 413.4 Z' }
    ],
    'savila': [
      { fill: [971.2, 566.9, 946.6, 583.1], fillStops: [[0, "#BC8E49"], [1, "#564121"]], stroke: [1012.2, 611.5, 976.2, 633.4], strokeStops: [[0, "#E1CFA6"], [1, "#E1CFA6", 0]], sw: 0.64,
        d: 'M 967.3 588.2 C 957.1 590.5 953.1 586.9 952.4 584.7 L 896.9 501.6 V 498.4 C 897.2 494.4 900.7 494.8 902.4 495.6 L 903 478.4 L 905.5 477.7 V 476.8 L 913.9 474.5 L 914.5 476.8 H 916.3 L 918.9 481.2 V 483.5 L 925.3 492.4 L 927.2 492.1 L 930.7 497.2 V 500.3 L 933.3 503.2 L 935.2 508.3 V 520.4 L 938.3 519.8 L 941.5 519.1 L 943.1 521.7 L 946.3 521.4 L 950.1 526.8 L 949.8 530.6 L 955.5 539.2 L 957.5 538.9 L 962.2 544.9 V 546.8 L 967 552.6 L 966.1 573.6 L 967 575.5 L 974.3 574.5 L 975.9 572.3 H 978.5 L 985.8 580.9 V 583.8 L 993.8 594.6 H 994.7 L 998.9 600.3 V 603.5 L 1003.3 611.8 V 618.8 L 1008.1 623 L 1014.5 622 L 1019.1 629.3 L 1018.3 632.2 L 1020.8 636.7 L 1023.4 640.8 L 1022.8 651.9 C 1025.3 651.2 1026.4 652.7 1026.6 653.5 L 1028.5 652.6 C 1031 651 1034 652.2 1035.2 652.9 L 1040 659.3 V 663.1 L 1048.6 675.2 L 1050.1 674.9 L 1054.9 681.9 V 684.1 L 1060.3 692.4 L 1057.8 713.7 L 1059.1 714.4 C 1067 718.5 1062.2 728.1 1053 729.7 C 1045.6 730.9 1040.4 726.4 1038.7 723.9 L 960.3 601.9 C 959 597.9 963.6 596.2 966.1 595.9 L 967.3 588.2 Z' }
    ],
    'mansion': [
      { fill: [971.3, 587.1, 924.5, 753.1], fillStops: [[0, "#BC8E49"], [1, "#3D312A"]], stroke: [990.8, 630, 1014.5, 680.2], strokeStops: [[0, "#E1CFA6"], [1, "#E1CFA6", 0]], sw: 0.64,
        d: 'M 1008.3 745.6 L 1030.1 737.7 C 1038.2 733.3 1034.6 728.4 1031.8 726.5 V 722.1 L 1030.1 718.7 L 1025.1 708 H 1022.9 L 1021.2 706.4 V 703.6 L 1016.7 695.2 L 1014.5 695.7 L 947.8 593.2 H 943.9 L 942.2 596.6 L 929.9 595.5 L 927.6 591.5 L 923.7 593.2 L 922.6 594.3 H 915.9 C 905.1 593.4 906.9 599.2 909.1 602.2 L 990.4 737.7 C 995.7 747.6 1004.6 747.1 1008.3 745.6 Z' },
      { fill: [971.3, 587.1, 924.5, 753.1], fillStops: [[0, "#BC8E49"], [1, "#3D312A"]], stroke: [990.8, 630, 1014.5, 680.2], strokeStops: [[0, "#E1CFA6"], [1, "#E1CFA6", 0]], sw: 0.64,
        d: 'M 975.8 754 C 983.9 750.8 982.9 744.5 981.4 741.7 L 896.8 596.6 C 895.5 594.3 890.7 590.4 888.4 588.7 C 886.6 585.1 883.6 587.2 882.3 588.7 L 877.2 590.4 L 874.4 601.1 L 953.4 748.4 C 961 762.3 971.5 757.9 975.8 754 Z' }
    ],
    'sarina': [
      { fill: [865.5, 411.4, 848.6, 429.3], fillStops: [[0, "#BC8E49"], [1, "#564121"]], stroke: [897.6, 435.1, 865.8, 458.9], strokeStops: [[0, "#E1CFA6"], [1, "#E1CFA6", 0]], sw: 0.64,
        d: 'M 886.8 487.9 L 828.5 397.5 C 827.2 393.9 829.5 392.8 830.7 392.7 C 830 391.4 831.1 390.9 831.7 390.8 L 832 375.5 L 840 373.9 L 840.6 375.5 L 842.5 375.8 L 853.4 387.6 V 389.8 L 851.8 390.1 L 857.4 397.8 L 857.2 398.4 L 860.4 402.6 V 409.9 L 866.1 408.9 L 869.9 413.4 H 871.2 L 880.8 427.1 L 906.2 466.3 V 476.9 L 905.6 477.1 V 478 L 903.1 478.7 L 902.4 492.4 C 894.8 495.9 888.8 490.9 886.8 487.9 Z' }
    ],
    'tthc-3d': [
      { fill: [950.6, 163.0, 946.6, 198.7], fillStops: [[0, "#BC8E49"], [1, "#564121"]], stroke: [886.2, 131.1, 857.9, 171.4], strokeStops: [[0, "#BC8E49", 0], [0.5, "#BC8E49"], [1, "#BC8E49", 0]], sw: 0.64,
        d: 'M 825.1 193.3 L 826.2 168.0 C 834.8 164.5 853.3 165.8 861.5 166.9 V 149.6 H 890.1 V 137.8 L 893.5 131.1 L 924.8 135.6 V 151.8 C 934.2 150.9 943.7 154.4 947.2 156.3 V 171.4 L 971.9 179.3 L 970.8 197.2 L 974.7 198.9 L 975.8 189.3 L 990.9 184.3 L 1016.1 193.8 L 1016.7 205.6 C 1024.3 206.0 1049.0 220.7 1060.4 228.0 L 1010.5 236.9 C 980.1 206.9 876.1 201.3 827.9 202.2 L 825.1 193.3 Z' }
    ]
  },

  /* 3D master map: road / bridge labels. dir = where the pill sits relative to the anchor.
     Bridge anchors sit on the bridge decks read from map-3d.jpg (pixel ÷ 1.8204):
     Ba Son (officially Thủ Thiêm 2) = inverted-Y cable-stayed bridge (top right), Thủ Thiêm 3 = single-pylon bridge (top left, confirmed by Hyun),
     Thủ Thiêm 1 = long bridge (right), Thủ Thiêm 4 = arch bridge (left).
     Cầu đi bộ: confirmed by Hyun; the render does not show its deck clearly, so it keeps the designer's Figma anchor. */
  roads: [
    { name: 'Đại lộ Vòng Cung', x: 1240.6, y: 226.0, dir: 'up', len: 80, path: 'vong-cung' },
    { name: 'Cầu Ba Son', x: 1153.6, y: 65.9, dir: 'down', len: 125 , bridge: true },   /* v9.2: named Cầu Ba Son (Hyun, 05/11) — the inverted-Y cable-stayed bridge, officially Thủ Thiêm 2 */
    { name: 'Cầu đi bộ', x: 984.2, y: 63.1, dir: 'down', len: 80 , bridge: true },
    { name: 'Cầu Thủ Thiêm 3', x: 576.8, y: 70.3, dir: 'left', len: 80 , bridge: true },
    { name: 'Đường Mai Chí Thọ', x: 1224.3, y: 740.4, dir: 'up', len: 160, path: 'mai-chi-tho' },
    { name: 'Đường Nguyễn Cơ Thạch', x: 640.1, y: 365.6, dir: 'down', len: 80, gold: true, path: 'nguyen-co-thach' },
    { name: 'Cầu Thủ Thiêm 1', x: 1455.7, y: 236.2, dir: 'left', len: 80 , bridge: true },
    { name: 'Cầu Thủ Thiêm 4', x: 54.9, y: 399.9, dir: 'right', len: 80 , bridge: true }
  ],

  /* 3D master map: moving light lines (Figma Vector 2375 / 2389 / 2391).
     Paths are in node space at 1.289× map scale, offset by (ox, oy) in that space. */
  lights: [
    { id: 'vong-cung', name: 'Đại lộ Vòng Cung', textAt: [1150, 205], ox: 466.45, oy: 154.94, color: '#C9C3B5', glow: '#FFF6DE', w: 1515.34,
      d: 'M 1459.2708419518872 421.87137804671397 C 965.3372799536056 569.8452102678963 791.1543967689745 607.697977146476 765.8046418216369 608.1276340358417 C 700.3249346886555 617.4082223237043 568.3773050154327 565.1619455602513 510.58845664358944 537.8787347181429 C 445.10874951060805 505.39667386673625 359.5628308803273 515.3217486986985 324.9748368006969 524.3445431064763 C 56.353364914893234 564.5604277359782 -3.4978534303320674 441.4207675692435 0.15422992516477382 374.8239500633011 C 32.37911527659981 286.09980177546413 160.89072019074973 92.66827480046257 417.1380858081933 28.735333535021454 C 552.6948273511714 -14.445182559343792 900.6309778183022 -41.38465839394024 1207.9215686704767 196.30151785226863 L 1515.341064453125 434.7607303171824',
      dur: 9 },
    { id: 'mai-chi-tho', name: 'Đường Mai Chí Thọ', textAt: [1140, 640], ox: 1032.18, oy: 128.25, color: '#C9C3B5', glow: '#FFF6DE', w: 566.78,
      d: 'M 2.2132499800752017 0 C -5.520573686508552 50.48468565658381 2.7288351206372568 175.04221898689593 97.5970701305849 269.3948670554739 C 115.42855510332956 290.66288287564294 158.18086218059585 343.2528846475633 186.53821562473627 383.4687700909258 L 327.0360122343411 566.502603209956 L 566.7845458984375 877.14453125',
      dur: 6 },
    { id: 'nguyen-co-thach', name: 'Đường Nguyễn Cơ Thạch', textAt: [420, 392], reverseText: true, ox: 227.5, oy: 286.8, color: '#FEC673', glow: '#FFE7B0', w: 1752.36, gold: true,
      d: 'M 1752.3555908203125 0 L 1250.9460102178105 117.94081903406092 C 1223.0183137458312 123.52635893818244 1145.250417391576 129.67045289417902 1057.6004135844548 109.5625094851932 C 1030.1023723548722 102.04351353133298 933.7303268074326 97.31728783684807 768.2265039565327 138.56435023127375 C 673.2723364435067 168.64033404671463 435.1564973567247 230.72575526881863 242.3264811138056 238.45957946777344 L 0 238.45957946777344',
      dur: 7 }
  ],

  /* Amenity map lines (v10.1, Figma 28418:14159 Vector 2413 "Tuyến Buggy"), in 3D map space (x1648/1471).
     Same interaction as the urban map roads: an idle comet now and then; hover / tap dims the map, lights the
     whole line and shows its name in the gold road tag at the pointer. */
  amenityLines: [
    { id: 'buggy', name: 'Tuyến Buggy', dur: 6,
      d: 'M 810.6 329.9 L 822.3 347.9 C 824.2 350.8 834.2 356.0 859.3 352.9 C 864.7 352.9 874.6 354.2 871.1 359.6 C 870.3 361.3 867.0 364.6 859.9 364.1 C 858.0 364.3 853.6 365.1 850.9 366.9 C 842.5 369.1 821.8 371.5 806.1 363.0 C 802.5 361.5 789.0 359.6 763.5 364.1 C 756.8 368.6 735.7 376.8 705.2 373.6 C 701.9 373.6 692.7 374.9 682.8 379.8 L 656.5 392.7 L 661.6 403.9 C 675.6 400.7 704.3 393.8 707.5 391.6 C 717.6 386.3 756.3 376.4 830.7 378.7 L 872.2 378.7 C 891.6 379.4 936.0 378.8 958.4 370.3 C 975.1 363.4 1011.0 350.9 1021.7 356.3' }
  ],

  /* Amenity map pins (v9.7): the urban 3D map, Figma "WEBSITE KHU ĐÔ THỊ SALA" 28418:14159 (20 pins, icon = Web/Icon/Amenity Type),
     x, y = pin centre in 3D map space (x1648/1471). Names (v10.0) = the 14 Figma labels 28423:16212 … 28422:15835, matched to pins
     by icon type, with Hyun's picks for the doubles (05/11): all 4 tòa nhà = Tháp Đôi Văn Phòng A+, Clubhouse Khu II = the Saroma pin,
     Khu III = the lower one, both giỏ hàng pins = Chuỗi TTTM Chủ Đề Kết Hợp Showroom, the 3 mua sắm pins = Chuỗi TTTM Đa Chức Năng. */
  amenities: [
    { id: 'cung-van-hoa', icon: 'vui-choi', name: 'Công Viên Văn Hóa Thiếu Nhi', x: 953.4, y: 296.9,
      data: {
        title: 'Công Viên Văn Hóa Thiếu Nhi',   /* v10.0: the exact name from Figma 28422:15835 */
        image: 'assets/img/cung-van-hoa/01.webp',
        desc: 'Không gian văn hóa, giáo dục và vui chơi dành cho trẻ em và gia đình, tích hợp các hoạt động học tập, sáng tạo, nghệ thuật và thể thao trong hệ sinh thái Sala.',
        stats: [['Quy mô khuôn viên', '20.000 m²'], ['Sức chứa tối đa', '20.000 người'], ['Không gian chức năng', '05 tầng'], ['Giờ hoạt động dự kiến', '08:00 – 21:00']],
        /* renders from the client (02/11) */
        gallery: [{ src: 'assets/img/cung-van-hoa/01.webp', thumb: 'assets/img/cung-van-hoa/01-t.webp' }, { src: 'assets/img/cung-van-hoa/02.webp', thumb: 'assets/img/cung-van-hoa/02-t.webp' }, { src: 'assets/img/cung-van-hoa/03.webp', thumb: 'assets/img/cung-van-hoa/03-t.webp' }, { src: 'assets/img/cung-van-hoa/04.webp', thumb: 'assets/img/cung-van-hoa/04-t.webp' }],
        cta: 'Xem chi tiết tiện ích', href: '#'
      } },
    { id: 'gio-hang-1', icon: 'gio-hang', name: 'Chuỗi TTTM Chủ Đề Kết Hợp Showroom', x: 984.8, y: 338.3 },
    { id: 'toa-nha-1', icon: 'toa-nha', name: 'Tháp Đôi Văn Phòng A+', x: 1029.6, y: 368.6 },
    { id: 'toa-nha-2', icon: 'toa-nha', name: 'Tháp Đôi Văn Phòng A+', x: 1056.5, y: 402.2 },
    { id: 'gio-hang-2', icon: 'gio-hang', name: 'Chuỗi TTTM Chủ Đề Kết Hợp Showroom', x: 1096.8, y: 477.3 },
    { id: 'y-te-1', icon: 'y-te', name: 'Bệnh Viện Quốc Tế', x: 1177.5, y: 572.5 },
    { id: 'du-thuyen-1', icon: 'du-thuyen', name: 'Bến Du Thuyền', x: 1133.8, y: 767.4 },
    { id: 'kim-cuong-1', icon: 'kim-cuong', name: 'Khách Sạn Siêu Sang', x: 1090.1, y: 643.1 },
    { id: 'mua-sam-1', icon: 'mua-sam', name: 'Chuỗi TTTM Đa Chức Năng', x: 1034.1, y: 568 },
    { id: 'mua-sam-2', icon: 'mua-sam', name: 'Chuỗi TTTM Đa Chức Năng', x: 1002.7, y: 519.8 },
    { id: 'toa-nha-3', icon: 'toa-nha', name: 'Tháp Đôi Văn Phòng A+', x: 962.4, y: 448.1 },
    { id: 'toa-nha-4', icon: 'toa-nha', name: 'Tháp Đôi Văn Phòng A+', x: 937.7, y: 419 },
    { id: 'mua-sam-3', icon: 'mua-sam', name: 'Chuỗi TTTM Đa Chức Năng', x: 900.7, y: 374.2 },
    { id: 'hotel-1', icon: 'hotel', name: 'Khách Sạn Cao Cấp', x: 848.1, y: 314.8 },
    { id: 'dich-1', icon: 'dich', name: 'Trường Song Ngữ Việt - Úc', x: 864.9, y: 531 },
    { id: 'am-nhac-1', icon: 'am-nhac', name: 'Clubhouse Khu III', x: 793.2, y: 519.8 },
    { id: 'toa-nha-2-1', icon: 'toa-nha-2', name: 'Phức Hợp TMDV Thiso Sala', x: 804.4, y: 248.7 },
    { id: 'giao-duc-1', icon: 'giao-duc', name: 'Trường Quốc Tế Liên Cấp', x: 739.4, y: 281.2 },
    { id: 'am-nhac-2', icon: 'am-nhac', name: 'Clubhouse Khu II', x: 667.7, y: 290.2 },
    { id: 'cong-vien-1', icon: 'cong-vien', name: 'Công Viên Sala', x: 786.5, y: 368.6 }
  ]
};
