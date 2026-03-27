const fs = require('fs');

async function run() {
  const userJson = JSON.parse(fs.readFileSync('./playwright/.auth/user.json', 'utf8'));
  const cookieObj = userJson.cookies.find(c => c.name.includes('-auth-token'));
  
  if (!cookieObj) {
    console.error("Auth cookie not found");
    process.exit(1);
  }

  const cookieHeader = `${cookieObj.name}=${cookieObj.value}`;

  const formData = new FormData();
  formData.append("descricao", "Teste Script API");
  formData.append("valor", "10,50"); // <--- VAMOS TESTAR A VÍRGULA!
  formData.append("categoria", "Outros");
  formData.append("tipo", "Saída");
  formData.append("data", new Date().toISOString());
  formData.append("status", "Realizado");

  try {
    const res = await fetch('http://localhost:3005/api/debug', {
      method: 'POST',
      headers: {
        'Cookie': cookieHeader
      },
      body: formData
    });

    const data = await res.json();
    console.log("STATUS:", res.status);
    console.log("RESPONSE:", JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("FETCH ERROR:", err);
  }
}

run();
