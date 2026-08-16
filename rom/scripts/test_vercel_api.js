async function run() {
  try {
    console.log('Sending test request to live Vercel API...');
    const response = await fetch('https://learntalk-rom.vercel.app/api/models/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model_id: '3fdc0fad-237e-49ed-92bd-da8f963ed2d7',
        format: 'text'
      })
    });
    
    const status = response.status;
    const body = await response.json();
    console.log(`Vercel API Status: ${status}`);
    console.log('Vercel API Response Body:', JSON.stringify(body, null, 2));
  } catch (err) {
    console.error('Fetch error:', err);
  }
}
run();
