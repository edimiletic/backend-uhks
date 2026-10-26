const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { pipeline } = require('stream/promises');
const mongoose = require('mongoose');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'travel-orders');
const TEMPLATE_PATH = path.join(__dirname, '..', 'templates', 'putni-nalog-hks.xls');
const GRID_BUCKET = 'travelOrders';

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

const upload = multer({
  storage: multer.memoryStorage(),
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

const gridFileName = (originalName) => {
  const ext = path.extname(originalName || '').toLowerCase();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`;
};

const toStoredFile = (file, fileId) => {
  if (!file) return null;
  return {
    originalName: file.originalname,
    storedName: file.filename || String(fileId || ''),
    fileId: fileId || undefined,
    mimeType: file.mimetype,
    size: file.size
  };
};

const fileDownloadTarget = (file) => {
  if (file?.fileId) {
    return { kind: 'grid', id: file.fileId };
  }
  if (file?.storedName) {
    return { kind: 'disk', storedName: file.storedName };
  }
  return null;
};

const getBucket = () => {
  const db = mongoose.connection.db;
  if (!db) {
    throw new Error('MongoDB is not connected');
  }
  return new mongoose.mongo.GridFSBucket(db, { bucketName: GRID_BUCKET });
};

const saveMulterFile = async (file) => {
  if (!file?.buffer) {
    throw new Error('Datoteka nije učitana.');
  }
  const filename = gridFileName(file.originalname);
  const bucket = getBucket();
  const uploadStream = bucket.openUploadStream(filename, {
    contentType: file.mimetype,
    metadata: { originalName: file.originalname }
  });
  await pipeline(Readable.from(file.buffer), uploadStream);
  return toStoredFile({ ...file, filename }, uploadStream.id);
};

const asObjectId = (value) => {
  if (value instanceof mongoose.Types.ObjectId) {
    return value;
  }
  return new mongoose.Types.ObjectId(String(value));
};

const absolutePath = (storedName) => {
  const safe = path.basename(storedName || '');
  return path.join(UPLOAD_DIR, safe);
};

const sendStoredFile = async (res, file) => {
  const target = fileDownloadTarget(file);
  if (!target) {
    return false;
  }
  if (target.kind === 'grid') {
    const bucket = getBucket();
    const download = bucket.openDownloadStream(asObjectId(target.id));
    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(file.originalName || 'datoteka')}`
    );
    await new Promise((resolve, reject) => {
      download.on('error', reject);
      res.on('error', reject);
      res.on('finish', resolve);
      download.pipe(res);
    });
    return true;
  }
  const filePath = absolutePath(target.storedName);
  if (!fs.existsSync(filePath)) {
    return false;
  }
  await new Promise((resolve, reject) => {
    res.download(filePath, file.originalName, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
  return true;
};

const removeStoredFile = async (file) => {
  if (file?.fileId) {
    try {
      await getBucket().delete(asObjectId(file.fileId));
    } catch (error) {
      if (error?.code !== 'ENOENT' && error?.message !== 'File not found') {
        console.error('GridFS delete failed:', error.message);
      }
    }
  }
  if (!file?.storedName) return;
  const target = absolutePath(file.storedName);
  await fs.promises.unlink(target).catch(() => {});
};

const removeExpenseFiles = async (expense) => {
  await Promise.all([
    removeStoredFile(expense?.nalogFile),
    removeStoredFile(expense?.fuelReceiptFile),
    removeStoredFile(expense?.tollReceiptFile)
  ]);
};

module.exports = {
  GRID_BUCKET,
  upload,
  TEMPLATE_PATH,
  toStoredFile,
  fileDownloadTarget,
  saveMulterFile,
  sendStoredFile,
  absolutePath,
  removeStoredFile,
  removeExpenseFiles
};
