/**
 * Скрипт для генерации bcrypt хеша пароля владельца.
 * Запуск: node scripts/hash-password.js
 * 
 * Использование:
 *   1. Запусти скрипт
 *   2. Введи пароль (он не будет отображаться)
 *   3. Скопируй полученный хеш
 *   4. Установи его в OWNER_PASSWORD_HASH на Vercel
 */
const bcrypt = require('bcryptjs');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true
});

// Set raw mode to hide password input
process.stdin.on('data', function(data) {
  // Don't echo password
});

console.log('');

rl.question('Введите пароль владельца: ', function(password) {
  if (!password || password.trim().length === 0) {
    console.error('\n❌ Пароль не может быть пустым!');
    rl.close();
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('\n❌ Пароль должен быть минимум 8 символов!');
    rl.close();
    process.exit(1);
  }

  const saltRounds = 12;

  console.log('\n⏳ Генерация хеша...');

  bcrypt.hash(password, saltRounds, function(err, hash) {
    if (err) {
      console.error('\n❌ Ошибка генерации хеша:', err.message);
      rl.close();
      process.exit(1);
    }

    console.log('\n✅ bcrypt хеш успешно сгенерирован!');
    console.log('\n' + '='.repeat(70));
    console.log('OWNER_PASSWORD_HASH=' + hash);
    console.log('='.repeat(70));
    console.log('\n📋 Скопируй эту строку и установи её в переменную');
    console.log('   окружения OWNER_PASSWORD_HASH на Vercel.');

    rl.close();
  });
});