import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  console.log('Fetching payments...');
  const paymentsSnap = await getDocs(collection(db, 'payments'));
  console.log(`Total payments in DB: ${paymentsSnap.size}`);
  
  const payments = [];
  paymentsSnap.forEach(doc => {
    payments.push({ id: doc.id, ...doc.data() });
  });

  // Group by studentId and monthPeriod, and check paidAt
  console.log('\n--- Recent Payments ---');
  payments.slice(-30).forEach(p => {
    console.log(`[${p.id}] studentId: ${p.studentId}, courseId: ${p.courseId}, month: ${p.monthPeriod}, amountPaid: ${p.amountPaid}/${p.finalAmountDue}, status: ${p.status}, paidAt: ${p.paidAt}, recordedBy: ${p.recordedBy}`);
  });

  console.log('\nFetching audit logs...');
  const auditSnap = await getDocs(collection(db, 'auditLogs'));
  console.log(`Total audit logs: ${auditSnap.size}`);
  const audits = [];
  auditSnap.forEach(doc => audits.push({ id: doc.id, ...doc.data() }));
  const paymentAudits = audits.filter(a => a.action?.includes('PAYMENT') || a.details?.includes('оплат') || a.details?.includes('взнос'));
  console.log(`Payment audit logs: ${paymentAudits.length}`);
  paymentAudits.slice(-30).forEach(a => {
    console.log(`[${a.timestamp}] [${a.action}] ${a.details}`);
  });

  process.exit(0);
}

run().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
