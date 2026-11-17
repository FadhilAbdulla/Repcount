// Test-only sample cohort (accounts on repcount.demo). The app itself never seeds these:
// the test suite inserts them into its throwaway TEST_DATABASE_URL after the server has created the schema.
import {randomBytes, scryptSync} from 'node:crypto';

const hash = password => {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 64).toString('hex')}`;
};
const istDay = () => {
  const now = new Date(new Date().toLocaleString('en-US', {timeZone: 'Asia/Kolkata'}));
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
};

export async function seedFixture(sql) {
  const day = istDay();
  const daysAgo = n => new Date(Date.parse(`${day}T00:00:00Z`) - n * 86400000).toISOString().slice(0, 10);
  await sql`insert into users (id, email, name, initials, role, password_hash, title, capacity) values
    ('u-member-aarav', 'member@repcount.demo', 'Aarav Sharma', 'AS', 'member', ${hash('Member#2026')}, null, 0),
    ('u-trainer-akif', 'trainer@repcount.demo', 'Akif', 'AK', 'trainer', ${hash('Trainer#2026')}, 'Lead trainer', 8),
    ('u-trainer-2', 'trainer2@repcount.demo', 'Trainer 2', 'T2', 'trainer', ${hash('Trainer2#2026')}, 'Trainer', 6),
    ('u-member-kabir', 'member2@repcount.demo', 'Kabir Mehta', 'KM', 'member', ${hash('Member2#2026')}, null, 0),
    ('u-admin', 'admin@repcount.demo', 'Super admin', 'SA', 'admin', ${hash('Admin#2026')}, null, 0)`;
  const clients = [
    ['c-aarav', 'u-member-aarav', 'Aarav S.', 'AS', 'Active', 'u-trainer-akif', true, 75, 'Build strength', daysAgo(1), 'Fri · 6:00 PM', null, 'member@repcount.demo', '+91 98200 11111', daysAgo(12)],
    ['c-maya', null, 'Maya R.', 'MR', 'Payment review', null, false, 0, 'Consistent routine', null, 'After activation', 'UPI-48213', 'maya@example.com', '+91 98200 22222', daysAgo(7)],
    ['c-riya', null, 'Riya K.', 'RK', 'Onboarding', null, true, 0, 'Confidence exercising', null, 'Onboarding call', null, 'riya@example.com', '+91 98200 33333', daysAgo(9)],
    ['c-kabir', 'u-member-kabir', 'Kabir M.', 'KM', 'Check-in due', 'u-trainer-akif', true, 50, 'Lose body fat', daysAgo(3), 'Today · 7:30 PM', null, 'member2@repcount.demo', '+91 98200 44444', daysAgo(12)],
    ['c-neha', null, 'Neha P.', 'NP', 'Active', 'u-trainer-akif', true, 100, 'Improve mobility', daysAgo(0), 'Sat · 10:00 AM', null, 'neha@example.com', '+91 98200 55555', daysAgo(12)],
  ];
  for (const [id, userId, name, initials, stage, trainerId, paid, progress, goal, lastWorkout, nextCheckin, reference, email, phone, joined] of clients) {
    await sql`insert into clients (id, user_id, name, initials, stage, trainer_id, paid, progress, goal, last_workout_on, next_checkin, payment_reference, email, phone, joined_on)
      values (${id}, ${userId}, ${name}, ${initials}, ${stage}, ${trainerId}, ${paid}, ${progress}, ${goal}, ${lastWorkout}, ${nextCheckin}, ${reference}, ${email}, ${phone}, ${joined})`;
  }
  await sql`update clients set intake = ${sql.json({place: 'At home', days: '3 days a week'})} where user_id is not null`;
  // A few dated weigh-ins so the member's progress charts have a history.
  const weights = [78.4, 78.2, 78.1, 77.8, 77.7].map((value, i) => ({label: daysAgo(10 - i * 2), value}));
  const fats = [27.0, 26.9, 26.9, 26.7, 26.6].map((value, i) => ({label: daysAgo(10 - i * 2), value}));
  await sql`insert into member_state (user_id, data) values ('u-member-aarav', ${sql.json({tracker: {weights, fats}})})`;
}
