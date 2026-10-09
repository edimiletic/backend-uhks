const fs = require('fs');
const path = require('path');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'travel-orders');
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'putni-nalog-hks.xls');

const NALOG_EXTS = new Set(['.xls', '.xlsx', '.pdf']);
const RECEIPT_EXTS = new Set(['.pdf']);
const NALOG_MIMES = new Set([
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream'
]);
const PDF_MIMES = new Set(['application/pdf', 'application/octet-stream']);

const isAllowedByExtAndMime = (ext, mimetype, allowedExts, allowedMimes) => {
  const mime = String(mimetype || '').toLowerCase();
  return allowedExts.has(ext) && allowedMimes.has(mime);
};

const ensureUploadDir = () => {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    ensureUploadDir();
    cb(null, UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (file.fieldname === 'nalog') {
      const allowedMimes = ext === '.pdf' ? PDF_MIMES : NALOG_MIMES;
      if (isAllowedByExtAndMime(ext, file.mimetype, NALOG_EXTS, allowedMimes)) {
        return cb(null, true);
      }
      return cb(new Error('Putni nalog mora biti Excel (.xls, .xlsx) ili PDF.'));
    }
    if (file.fieldname === 'fuelReceipt' || file.fieldname === 'tollReceipt') {
      if (isAllowedByExtAndMime(ext, file.mimetype, RECEIPT_EXTS, PDF_MIMES)) {
        return cb(null, true);
      }
      return cb(new Error('Račun mora biti PDF.'));
    }
    return cb(new Error('Nepoznata datoteka.'));
  }
});

const toStoredFile = (file) => {
  if (!file) return null;
  return {
    originalName: file.originalname,
    storedName: file.filename,
    mimeType: file.mimetype,
    size: file.size
  };
};

const absolutePath = (storedName) => {
  const safe = path.basename(storedName || '');
  return path.join(UPLOAD_DIR, safe);
};

const removeStoredFile = (file) => {
  if (!file?.storedName) return;
  const target = absolutePath(file.storedName);
  fs.unlink(target, () => {});
};

const removeExpenseFiles = (expense) => {
  removeStoredFile(expense?.nalogFile);
  removeStoredFile(expense?.fuelReceiptFile);
  removeStoredFile(expense?.tollReceiptFile);
};

module.exports = {
  upload,
  TEMPLATE_PATH,
  toStoredFile,
  absolutePath,
  removeStoredFile,
  removeExpenseFiles
};
