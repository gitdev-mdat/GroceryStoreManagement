// =============================================================================
// Vietnamese Grocery / Consumer Goods Abbreviation Dictionary
// Mỗi entry: key = từ viết tắt, value = tên đầy đủ bằng tiếng Việt
// File này được inject trực tiếp vào prompt OCR của Gemini.
// Quy tắc:
//   - Chỉ thêm các MÃ THƯƠNG HIỆU thực sự cần thiết (KD, SURF, OMO, …)
//   - KHÔNG thêm từ viết tắt 1-2 ký tự (NG, BO, GA, CA, BOT …) vì gây trùng âm tiết
//   - KHÔNG trùng key; mỗi key là duy nhất
// =============================================================================

export const abbreviationDictionary = {
  // ---- Thương hiệu thực phẩm & đồ uống ----
  'KD':   'Kinh Đô',
  'BMT':  'Bánh mì tươi',
  'BBL':  'Bánh bông lan',
  'MTR':  'Mì trộn',
  'MHG':  'Mì Hảo Hảo',
  'OFR':  'Orion',
  'VNL':  'Vinamilk',
  'TH':   'TH True Milk',

  // ---- Hóa mỹ phẩm & vệ sinh ----
  'SURF':    'Nước giặt Surf',
  'OMO':     'Nước giặt OMO',
  'TIDE':    'Nước giặt Tide',
  'DOWNY':   'Nước xả vải Downy',
  'VIM':     'Nước lau sàn Vim',
  'SUNLIGHT': 'Nước rửa chén Sunlight',
  'DAEWOO':  'Máy giặt Daewoo',

  // ---- Từ khóa khuyến mãi / giao dịch ----
  'KM':   'Khuyến mãi',
  'CK':   'Chiết khấu',
  'QA':   'Quà tặng',
  'TG':   'Tặng',

  // ---- Loại sản phẩm đặc biệt (mã rõ ràng, không trùng âm tiết) ----
  'KIM':  'Nước mắm Kim',
}
