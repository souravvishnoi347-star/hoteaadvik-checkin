import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://ngdauzleenttiwpiokug.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nZGF1emxlZW50dGl3cGlva3VnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4NDg4NTYsImV4cCI6MjA5NzQyNDg1Nn0.n_1dObQn8cDq1qGGatXra1j-ykKydgfTBZ21_81A_Qg');

async function test() {
  console.log("Testing Bookings insert...");
  const { data, error } = await supabase
    .from('Bookings')
    .insert({
      check_in_date: '2026-05-27',
      check_out_date: '2026-05-28'
    })
    .select();
  
  if (error) {
    console.error("Bookings error:", error);
    
    // Fallback: try lowercase
    console.log("Trying lowercase 'bookings'...");
    const { data: d2, error: e2 } = await supabase
      .from('bookings')
      .insert({
        check_in_date: '2026-05-27',
        check_out_date: '2026-05-28'
      })
      .select();
      
    if (e2) {
      console.error("lowercase bookings error:", e2);
    } else {
      console.log("Lowercase bookings worked!", d2);
    }
    
  } else {
    console.log("Bookings success:", data);
  }
}

test();
