// =====================================================================================
//  DANH SÁCH CHƯƠNG — chế độ CỐT TRUYỆN
//  Thêm chương mới: tạo file story/chuongX.js (sao chép chuong1.js), import vào đây và thêm vào CHAPTERS.
//  Nhớ thêm tên file vào CODE_FILES trong index.html.
//  Chương chưa có nội dung: { id, no, title, locked: true, teaser }
// =====================================================================================
import chuong1 from "./chuong1.js";

export const CHAPTERS = [
  chuong1,
  { id: "ch2", no: 2, title: "Sắp ra mắt", locked: true, teaser: "Đang chờ kịch bản..." },
  { id: "ch3", no: 3, title: "Sắp ra mắt", locked: true, teaser: "Đang chờ kịch bản..." },
];
