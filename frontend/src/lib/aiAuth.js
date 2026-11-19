import {supabase} from './supabase';

// Only a Supabase access token is sent to our own same-origin Cloudflare Function.
// Never send a Gemini API key to the browser.
export async function aiRequestHeaders() {
  const {data,error}=await supabase.auth.getSession();
  if(error || !data?.session?.access_token) {
    throw new Error('Sign in to use AI features. Guest camera tracking remains available.');
  }
  return {'Content-Type':'application/json',Authorization:'Bearer '+data.session.access_token};
}
