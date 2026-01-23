require('dotenv').config();
const { Sequelize } = require('sequelize');

console.log('🔍 Testing Database Connection...\n');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'istekhara',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false
  }
);

async function testConnection() {
  console.log('Connection Details:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Database:', process.env.DB_NAME || 'istekhara');
  console.log('User:    ', process.env.DB_USER || 'postgres');
  console.log('Host:    ', process.env.DB_HOST || 'localhost');
  console.log('Port:    ', process.env.DB_PORT || 5432);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    await sequelize.authenticate();
    console.log('✅ SUCCESS! Database connection established.\n');
    
    // Test query
    const [results] = await sequelize.query('SELECT version();');
    console.log('PostgreSQL Version:', results[0].version.split(',')[0]);
    
    // Check if tables exist
    const [tables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE 'api_%'
      ORDER BY table_name;
    `);
    
    if (tables.length > 0) {
      console.log('\n📊 Found Django tables:');
      tables.forEach(t => console.log('  -', t.table_name));
    } else {
      console.log('\n⚠️  Warning: No Django tables found (api_*)');
      console.log('   You may need to run Django migrations first.');
    }
    
    console.log('\n✨ Database is ready for Express backend!\n');
    process.exit(0);
  } catch (error) {
    console.error('❌ FAILED! Database connection error:\n');
    console.error('Error:', error.message);
    console.error('\n📋 Troubleshooting Steps:');
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.error('1. Check if PostgreSQL is running:');
    console.error('   Windows: services.msc → postgresql-x64-XX');
    console.error('   Mac:     brew services start postgresql');
    console.error('   Linux:   sudo systemctl start postgresql\n');
    console.error('2. Verify database exists:');
    console.error('   psql -U postgres');
    console.error('   CREATE DATABASE istekhara;\n');
    console.error('3. Check credentials in .env file\n');
    console.error('4. Test connection:');
    console.error('   psql -U postgres -d istekhara\n');
    console.error('See TROUBLESHOOTING.md for detailed help.\n');
    process.exit(1);
  }
}

testConnection();
