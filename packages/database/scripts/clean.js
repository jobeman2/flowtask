// Wipes all data from database / disk JSON
const path = require('path');
const fs = require('fs');

const candidates = [
  path.resolve(process.cwd(), 'flowtask_db.json'),
  path.resolve(process.cwd(), '../../flowtask_db.json'),
  path.resolve(__dirname, '../../flowtask_db.json'),
  path.resolve(__dirname, '../flowtask_db.json'),
  'd:\\Thrive Inc\\FLOW TASK\\flowtask_db.json',
  'd:\\TIBEBE\\flowtask\\flowtask_db.json',
];

for (const c of candidates) {
  if (fs.existsSync(c)) {
    try {
      fs.unlinkSync(c);
      console.log('[Clean DB] Deleted local database JSON file:', c);
    } catch (e) {
      console.warn('[Clean DB] Could not delete', c, e.message);
    }
  }
}

console.log('[Clean DB] Database reset complete. All test data wiped.');
