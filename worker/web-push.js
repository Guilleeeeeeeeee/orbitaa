// RFC 8291 (aes128gcm) and RFC 8292 (VAPID), using Workers' Web Crypto.
const enc = new TextEncoder();
export const encode64 = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export const decode64 = value => Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
const concat = (...arrays) => {const result=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let offset=0;for(const a of arrays){result.set(a,offset);offset+=a.length;}return result;};
async function hkdf(input,salt,info,length){const key=await crypto.subtle.importKey('raw',input,'HKDF',false,['deriveBits']);return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,length*8));}
export function validSubscription(value){
  try {
    const url=new URL(value.endpoint);
    const allowed=url.hostname==='web.push.apple.com'||url.hostname==='fcm.googleapis.com'||url.hostname==='updates.push.services.mozilla.com'||url.hostname.endsWith('.push.services.mozilla.com');
    return allowed&&url.protocol==='https:'&&!url.username&&!url.password&&!url.port&&value.endpoint.length<=2048&&/^[-_A-Za-z0-9]{87}$/.test(value.keys.p256dh)&&decode64(value.keys.p256dh)[0]===4&&/^[-_A-Za-z0-9]{22}$/.test(value.keys.auth);
  }catch{return false;}
}
export async function generateVapid(){const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);return {publicKey:encode64(await crypto.subtle.exportKey('raw',pair.publicKey)),privateKey:await crypto.subtle.exportKey('jwk',pair.privateKey)};}
export async function encryptPayload(subscription,payload){
  const receiver=decode64(subscription.keys.p256dh),auth=decode64(subscription.keys.auth);
  const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const sender=new Uint8Array(await crypto.subtle.exportKey('raw',pair.publicKey));
  const receiverKey=await crypto.subtle.importKey('raw',receiver,{name:'ECDH',namedCurve:'P-256'},false,[]);
  const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:receiverKey},pair.privateKey,256));
  const input=await hkdf(shared,auth,concat(enc.encode('WebPush: info\0'),receiver,sender),32);
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const cek=await hkdf(input,salt,enc.encode('Content-Encoding: aes128gcm\0'),16);
  const nonce=await hkdf(input,salt,enc.encode('Content-Encoding: nonce\0'),12);
  const plaintext=concat(enc.encode(JSON.stringify(payload)),new Uint8Array([2]));
  if(plaintext.length+16>4096)throw Error('Push payload too large');
  const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
  const ciphertext=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,plaintext));
  // salt (16), record size (4, big endian), public key length (1), public key.
  return concat(salt,new Uint8Array([0,0,16,0,65]),sender,ciphertext);
}
export async function sendPush(subscription,vapid,payload,origin,fetcher=fetch){
  const header=encode64(enc.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
  const claims=encode64(enc.encode(JSON.stringify({aud:new URL(subscription.endpoint).origin,exp:Math.floor(Date.now()/1000)+3600,sub:origin})));
  const key=await crypto.subtle.importKey('jwk',vapid.privateKey,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const signature=encode64(await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(header+'.'+claims)));
  return fetcher(subscription.endpoint,{method:'POST',redirect:'error',headers:{Authorization:`vapid t=${header}.${claims}.${signature}, k=${vapid.publicKey}`,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:'60',Urgency:'high',Topic:'jp7-2323'},body:await encryptPayload(subscription,payload)});
}
