import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const paymentsSnap = await getDocs(collection(db, 'payments'));
  const payments = [];
  paymentsSnap.forEach(doc => {
    payments.push({ id: doc.id, ...doc.data() });
  });

  const studentsSnap = await getDocs(collection(db, 'students'));
  const students = {};
  studentsSnap.forEach(d => {
    students[d.id] = d.data().fullName;
  });

  const map = new Map();
  payments.forEach(p => {
    const key = `${p.studentId}___${p.courseId}___${p.monthPeriod}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(p);
  });

  for (const [key, list] of map.entries()) {
    if (list.length > 1) {
      const [stId, cId, m] = key.split('___');
      console.log(`\nKey: ${key} (${students[stId]})`);
      list.forEach(p => {
        console.log(`  id: ${p.id} | amountPaid: ${p.amountPaid} | finalAmountDue: ${p.finalAmountDue} | paidAt: ${p.paidAt} | status: ${p.status}`);
      });
    }
  }

  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
