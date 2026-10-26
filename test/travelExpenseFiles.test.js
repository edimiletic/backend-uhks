const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
  toStoredFile,
  fileDownloadTarget
} = require('../utils/travelExpenseFiles');

describe('travelExpenseFiles', () => {
  it('toStoredFile pamti GridFS id uz originalni naziv', () => {
    const stored = toStoredFile(
      {
        originalname: 'nalog.pdf',
        filename: '123-abc.pdf',
        mimetype: 'application/pdf',
        size: 2048
      },
      '507f1f77bcf86cd799439011'
    );
    assert.equal(stored.originalName, 'nalog.pdf');
    assert.equal(stored.storedName, '123-abc.pdf');
    assert.equal(stored.fileId, '507f1f77bcf86cd799439011');
    assert.equal(stored.mimeType, 'application/pdf');
    assert.equal(stored.size, 2048);
  });

  it('fileDownloadTarget bira GridFS prije starog diska', () => {
    assert.deepEqual(
      fileDownloadTarget({ fileId: 'gid-1', storedName: 'old.pdf' }),
      { kind: 'grid', id: 'gid-1' }
    );
    assert.deepEqual(
      fileDownloadTarget({ storedName: 'old.pdf' }),
      { kind: 'disk', storedName: 'old.pdf' }
    );
    assert.equal(fileDownloadTarget(null), null);
  });
});
