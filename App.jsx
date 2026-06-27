import { useState, useEffect, useRef } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const PAYSTACK_KEY   = "pk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const AMOUNT_KOBO    = 100000;
const INIT_BALANCE   = 350900.01;

// ─────────────────────────────────────────────────────────────────────────────
// COLOR TOKENS  — GCash blue palette
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  primary:   "#0063CC",   // GCash signature blue
  primaryDk: "#004EA3",
  primaryMd: "#0070E0",
  primaryLt: "#E6F0FF",
  accent:    "#003880",
  bg:        "#F0F4FA",
  card:      "#FFFFFF",
  border:    "#E2EAF4",
  t1:        "#0D1B2A",
  t2:        "#3D5166",
  t3:        "#8899AA",
  t4:        "#C8D4E0",
  red:       "#E53935",
  amber:     "#F59E0B",
  green:     "#16A34A",
  purple:    "#7C3AED",
  shadow:    "rgba(0,99,204,0.07)",
  shadowMd:  "rgba(0,99,204,0.13)",
};

// ─────────────────────────────────────────────────────────────────────────────
// UTILS
// ─────────────────────────────────────────────────────────────────────────────
const fmt      = n => "₱" + Number(n).toLocaleString("en-PH",{minimumFractionDigits:2});
const fmtShort = n => n >= 1000 ? "₱"+(n/1000).toFixed(0)+"K" : fmt(n);
const today    = () => new Date().toLocaleDateString("en-PH",{month:"short",day:"numeric",year:"numeric"});
const randKey  = () => { const s=()=>Math.floor(1000+Math.random()*9000); return `${s()}-${s()}-${s()}-${s()}`; };
const initials = name => name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2);
const uid      = () => Math.random().toString(36).slice(2,9).toUpperCase();
const hash     = async pw => { const b=new TextEncoder().encode(pw); const d=await crypto.subtle.digest("SHA-256",b); return Array.from(new Uint8Array(d)).map(x=>x.toString(16).padStart(2,"0")).join(""); };

// ─────────────────────────────────────────────────────────────────────────────
// "DATABASE"  — localStorage persistence
// ─────────────────────────────────────────────────────────────────────────────
const DB = {
  getUsers: ()     => JSON.parse(localStorage.getItem("pv_users")||"[]"),
  saveUsers: users => localStorage.setItem("pv_users", JSON.stringify(users)),
  getTxns: email   => JSON.parse(localStorage.getItem(`pv_txns_${email}`)||"[]"),
  saveTxns: (email,txns) => localStorage.setItem(`pv_txns_${email}`, JSON.stringify(txns)),
  getBalance: email => {
    const u = DB.getUsers().find(u=>u.email===email);
    return u ? u.balance : INIT_BALANCE;
  },
  updateBalance: (email,bal) => {
    const users = DB.getUsers();
    const idx = users.findIndex(u=>u.email===email);
    if(idx>-1){ users[idx].balance=bal; DB.saveUsers(users); }
  },
  saveSession: (email) => localStorage.setItem("pv_session", email),
  getSession:  ()      => localStorage.getItem("pv_session"),
  clearSession:()      => localStorage.removeItem("pv_session"),
};

// ─────────────────────────────────────────────────────────────────────────────
// GLOBAL STYLES
// ─────────────────────────────────────────────────────────────────────────────
const GS = () => (
  <style>{`
    *{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
    html,body{height:100%;}
    body{background:#D6E4F7;font-family:'Inter',system-ui,sans-serif;color:${C.t1};}
    input,button,select,textarea{font-family:inherit;}
    input[type=number]::-webkit-inner-spin-button{-webkit-appearance:none;}
    ::-webkit-scrollbar{width:3px;}
    ::-webkit-scrollbar-thumb{background:${C.t4};border-radius:4px;}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes slideUp{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
    @keyframes slideDown{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes pop{0%{transform:scale(.88);opacity:0}70%{transform:scale(1.04)}100%{transform:scale(1);opacity:1}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
  `}</style>
);

// ─────────────────────────────────────────────────────────────────────────────
// PRIMITIVES
// ─────────────────────────────────────────────────────────────────────────────
const Screen = ({children,style={}}) => (
  <div style={{minHeight:"100vh",maxWidth:430,margin:"0 auto",background:C.bg,
    display:"flex",flexDirection:"column",position:"relative",overflow:"hidden",
    animation:"fadeIn .18s ease",...style}}>
    {children}
  </div>
);

const Field = ({label,error,hint,children}) => (
  <div style={{marginBottom:error?10:14}}>
    {label&&<label style={{display:"block",fontSize:12,fontWeight:600,color:C.t2,marginBottom:5,letterSpacing:".01em"}}>{label}</label>}
    {children}
    {error&&<p style={{fontSize:12,color:C.red,marginTop:4,display:"flex",alignItems:"center",gap:3}}><span>⚠</span>{error}</p>}
    {hint&&!error&&<p style={{fontSize:12,color:C.t3,marginTop:4}}>{hint}</p>}
  </div>
);

const Input = ({icon,suffix,error,...p}) => (
  <div style={{position:"relative"}}>
    {icon&&<span style={{position:"absolute",left:13,top:"50%",transform:"translateY(-50%)",fontSize:16,pointerEvents:"none",opacity:.6}}>{icon}</span>}
    <input {...p} style={{
      width:"100%", padding:icon?"13px 14px 13px 40px":"13px 14px",
      paddingRight:suffix?"58px":"14px",
      background:C.card, border:`1.5px solid ${error?C.red:C.border}`,
      borderRadius:12, fontSize:15, color:C.t1, outline:"none",
      transition:"border-color .15s,box-shadow .15s",
      ...p.style,
    }}
      onFocus={e=>{e.target.style.borderColor=C.primary;e.target.style.boxShadow=`0 0 0 3px ${C.primaryLt}`;}}
      onBlur={e=>{e.target.style.borderColor=error?C.red:C.border;e.target.style.boxShadow="none";}}
    />
    {suffix&&<span style={{position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",fontSize:12,color:C.t3,fontWeight:600,pointerEvents:"none"}}>{suffix}</span>}
  </div>
);

const Btn = ({children,variant="primary",loading,size="md",icon,...p}) => {
  const V = {
    primary:{bg:`linear-gradient(135deg,${C.primaryMd},${C.primaryDk})`,color:"#fff",border:"none",shadow:`0 4px 16px ${C.primary}45`},
    outline:{bg:"transparent",color:C.primary,border:`1.5px solid ${C.primary}`,shadow:"none"},
    ghost:  {bg:"transparent",color:C.t2,border:"none",shadow:"none"},
    danger: {bg:`linear-gradient(135deg,#EF4444,#B91C1C)`,color:"#fff",border:"none",shadow:"0 4px 14px rgba(239,68,68,.35)"},
    white:  {bg:C.card,color:C.primary,border:`1px solid ${C.border}`,shadow:`0 2px 8px ${C.shadow}`},
  };
  const S = {md:{padding:"14px 20px",fontSize:15,radius:13},sm:{padding:"9px 16px",fontSize:13,radius:10}};
  const v=V[variant]||V.primary; const s=S[size]||S.md;
  return (
    <button {...p} disabled={loading||p.disabled} style={{
      width:"100%",padding:s.padding,borderRadius:s.radius,fontWeight:700,fontSize:s.fontSize,
      cursor:loading||p.disabled?"not-allowed":"pointer",
      background:v.bg,color:v.color,border:v.border||"none",
      display:"flex",alignItems:"center",justifyContent:"center",gap:8,
      opacity:loading||p.disabled?.65:1,
      transition:"opacity .15s,transform .1s,box-shadow .15s",
      boxShadow:v.shadow,
      ...p.style,
    }}
      onMouseEnter={e=>{if(!loading&&!p.disabled){e.currentTarget.style.opacity=".88";e.currentTarget.style.transform="translateY(-1px)";}}}
      onMouseLeave={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.transform="translateY(0)";}}
      onMouseDown={e=>e.currentTarget.style.transform="scale(.98)"}
      onMouseUp={e=>e.currentTarget.style.transform="translateY(-1px)"}
    >
      {loading&&<span style={{width:17,height:17,border:"2.5px solid rgba(255,255,255,.35)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite",flexShrink:0}}/>}
      {!loading&&icon&&<span style={{fontSize:17}}>{icon}</span>}
      {children}
    </button>
  );
};

const Badge = ({children,color=C.primary}) => (
  <span style={{background:color+"18",color,fontSize:11,fontWeight:700,padding:"3px 8px",borderRadius:20}}>{children}</span>
);

const Divider = ({label}) => (
  <div style={{display:"flex",alignItems:"center",gap:10,margin:"4px 0"}}>
    <div style={{flex:1,height:1,background:C.border}}/>
    {label&&<span style={{fontSize:12,color:C.t3,fontWeight:500,whiteSpace:"nowrap"}}>{label}</span>}
    <div style={{flex:1,height:1,background:C.border}}/>
  </div>
);

const Card = ({children,style={}}) => (
  <div style={{background:C.card,borderRadius:18,padding:18,boxShadow:`0 1px 6px ${C.shadow}`,...style}}>
    {children}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// TOAST
// ─────────────────────────────────────────────────────────────────────────────
const ToastCtx = ({toast}) => {
  if(!toast) return null;
  const icons={success:"✓",error:"✕",info:"ℹ"};
  const bgs={success:C.primary,error:C.red,info:C.primaryMd};
  return (
    <div style={{
      position:"fixed",top:56,left:"50%",transform:"translateX(-50%)",
      background:bgs[toast.type]||C.t1,color:"#fff",
      padding:"11px 18px",borderRadius:14,fontSize:13,fontWeight:600,
      zIndex:9999,boxShadow:`0 8px 28px rgba(0,0,0,.18)`,
      animation:"slideDown .22s ease",display:"flex",alignItems:"center",gap:8,
      maxWidth:"88vw",
    }}>
      <span style={{fontSize:14}}>{icons[toast.type]}</span>{toast.msg}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BOTTOM TABS
// ─────────────────────────────────────────────────────────────────────────────
const TABS = [
  {id:"home",   label:"Home",
    icon:a=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?C.primary:C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z"/><path d="M9 21V12h6v9"/></svg>},
  {id:"reward", label:"Rewards",
    icon:a=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?C.primary:C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M12 13v9M8 17l4 5 4-5"/></svg>},
  {id:"buykey", label:"Key",
    icon:a=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?C.primary:C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="M21 2l-9.6 9.6M15.5 7.5l2 2"/></svg>},
  {id:"profile",label:"Profile",
    icon:a=><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={a?C.primary:C.t3} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>},
];

const BottomTabs = ({active,onChange}) => (
  <div style={{background:C.card,borderTop:`1px solid ${C.border}`,display:"flex",
    padding:"9px 4px 20px",flexShrink:0,
    boxShadow:`0 -4px 18px ${C.shadow}`}}>
    {TABS.map(tab=>{
      const isActive=active===tab.id;
      return (
        <button key={tab.id} onClick={()=>onChange(tab.id)} style={{
          flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,
          background:"none",border:"none",cursor:"pointer",padding:"3px 0",transition:"transform .1s",
        }}
          onMouseDown={e=>e.currentTarget.style.transform="scale(.88)"}
          onMouseUp={e=>e.currentTarget.style.transform="scale(1)"}
          onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}
        >
          <div style={{position:"relative"}}>
            {tab.icon(isActive)}
            {isActive&&<div style={{position:"absolute",bottom:-5,left:"50%",transform:"translateX(-50%)",width:16,height:3,background:C.primary,borderRadius:4}}/>}
          </div>
          <span style={{fontSize:10,fontWeight:isActive?700:500,color:isActive?C.primary:C.t3,transition:"color .15s"}}>{tab.label}</span>
        </button>
      );
    })}
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// SPLASH
// ─────────────────────────────────────────────────────────────────────────────
const SplashScreen = ({onNext}) => {
  useEffect(()=>{const t=setTimeout(onNext,2400);return()=>clearTimeout(t);},[]);
  return (
    <Screen style={{background:`linear-gradient(160deg,${C.primary} 0%,${C.primaryDk} 100%)`,justifyContent:"center",alignItems:"center"}}>
      <div style={{textAlign:"center",animation:"pop .55s ease"}}>
        <div style={{width:96,height:96,background:"rgba(255,255,255,.18)",borderRadius:32,
          display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 22px",
          backdropFilter:"blur(8px)",border:"1.5px solid rgba(255,255,255,.25)"}}>
          <svg width="50" height="50" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="5" width="20" height="14" rx="3" fill="white" fillOpacity=".9"/>
            <path d="M2 10h20" stroke={C.primary} strokeWidth="2"/>
            <rect x="5" y="13" width="5" height="2" rx="1" fill={C.primary}/>
          </svg>
        </div>
        <h1 style={{color:"#fff",fontSize:34,fontWeight:900,letterSpacing:"-.5px"}}>PesoVault</h1>
        <p style={{color:"rgba(255,255,255,.65)",fontSize:14,marginTop:6}}>Your smart digital wallet</p>
      </div>
      <div style={{position:"absolute",bottom:50}}>
        <div style={{display:"flex",gap:6}}>
          {[0,1,2].map(i=><div key={i} style={{width:i===0?24:7,height:7,borderRadius:4,background:i===0?"#fff":"rgba(255,255,255,.35)",transition:"width .3s"}}/>)}
        </div>
      </div>
    </Screen>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SIGN UP
// ─────────────────────────────────────────────────────────────────────────────
const SignUpScreen = ({onSignUp,goLogin}) => {
  const [f,setF]       = useState({name:"",email:"",password:"",confirm:""});
  const [e,setE]       = useState({});
  const [show,setShow] = useState(false);
  const [loading,setLoading] = useState(false);
  const [serverErr,setServerErr] = useState("");
  const set = k => ev => setF({...f,[k]:ev.target.value});

  const validate = () => {
    const err={};
    if(!f.name.trim()||f.name.trim().split(" ").length<2) err.name="Enter your full name (first & last)";
    if(!/\S+@\S+\.\S+/.test(f.email)) err.email="Enter a valid email address";
    if(f.password.length<6) err.password="Password must be at least 6 characters";
    if(f.password!==f.confirm) err.confirm="Passwords do not match";
    setE(err); return !Object.keys(err).length;
  };

  const submit = async () => {
    if(!validate()) return;
    setLoading(true); setServerErr("");
    // Check if email already exists
    const existing = DB.getUsers().find(u=>u.email.toLowerCase()===f.email.toLowerCase());
    if(existing){ setLoading(false); setServerErr("An account with this email already exists."); return; }
    // Hash password & save
    const pwHash = await hash(f.password);
    const newUser = {
      id: uid(), name:f.name.trim(), email:f.email.toLowerCase(),
      passwordHash: pwHash, balance: INIT_BALANCE, createdAt: new Date().toISOString(),
    };
    const users = DB.getUsers();
    DB.saveUsers([...users, newUser]);
    const welcomeTxn = {id:uid(),type:"bonus",label:"Welcome Bonus",amount:INIT_BALANCE,date:today(),status:"success"};
    DB.saveTxns(newUser.email, [welcomeTxn]);
    setTimeout(()=>{ setLoading(false); onSignUp(newUser); }, 900);
  };

  return (
    <Screen style={{background:C.card,overflowY:"auto"}}>
      {/* Blue hero */}
      <div style={{background:`linear-gradient(160deg,${C.primary} 0%,${C.primaryDk} 100%)`,padding:"52px 24px 32px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-50,right:-50,width:160,height:160,borderRadius:"50%",background:"rgba(255,255,255,.06)"}}/>
        <div style={{width:52,height:52,background:"rgba(255,255,255,.18)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",border:"1px solid rgba(255,255,255,.25)"}}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="5" width="20" height="14" rx="3" fill="white" fillOpacity=".9"/>
            <path d="M2 10h20" stroke={C.primary} strokeWidth="2"/>
            <rect x="5" y="13" width="5" height="2" rx="1" fill={C.primary}/>
          </svg>
        </div>
        <h1 style={{color:"#fff",fontSize:22,fontWeight:800}}>PesoVault</h1>
        <p style={{color:"rgba(255,255,255,.65)",fontSize:13,marginTop:3}}>Create your free account</p>
      </div>

      {/* Bonus strip */}
      <div style={{background:C.primaryLt,borderBottom:`1px solid ${C.border}`,padding:"10px 20px",display:"flex",alignItems:"center",gap:8}}>
        <span style={{fontSize:18}}>🎁</span>
        <p style={{fontSize:13,color:C.primaryDk,fontWeight:600}}>Get <strong>{fmt(INIT_BALANCE)}</strong> welcome balance instantly!</p>
      </div>

      <div style={{padding:"20px 20px 36px",flex:1}}>
        {serverErr&&(
          <div style={{background:"#FEF2F2",border:`1px solid #FECACA`,borderRadius:12,padding:"11px 14px",color:C.red,fontSize:13,marginBottom:14,display:"flex",gap:8,alignItems:"center"}}>
            <span>⚠️</span>{serverErr}
          </div>
        )}
        <Field label="Full Name" error={e.name}><Input icon="👤" placeholder="Juan dela Cruz" value={f.name} onChange={set("name")} error={e.name}/></Field>
        <Field label="Email Address" error={e.email}><Input icon="✉️" type="email" placeholder="juan@email.com" value={f.email} onChange={set("email")} error={e.email}/></Field>
        <Field label="Password" error={e.password}>
          <div style={{position:"relative"}}>
            <Input icon="🔒" type={show?"text":"password"} placeholder="Min. 6 characters" value={f.password} onChange={set("password")} error={e.password}/>
            <button onClick={()=>setShow(v=>!v)} style={{position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:13,color:C.t3}}>{show?"🙈":"👁"}</button>
          </div>
        </Field>
        <Field label="Confirm Password" error={e.confirm}><Input icon="🔒" type={show?"text":"password"} placeholder="Re-enter password" value={f.confirm} onChange={set("confirm")} error={e.confirm}/></Field>

        <div style={{marginTop:10}}><Btn loading={loading} onClick={submit}>Create Account</Btn></div>
        <Divider label="Already have an account?"/>
        <Btn variant="outline" onClick={goLogin}>Sign In</Btn>
        <p style={{textAlign:"center",fontSize:11,color:C.t3,marginTop:18,lineHeight:1.7}}>
          By creating an account you agree to our<br/>Terms of Service and Privacy Policy.
        </p>
      </div>
    </Screen>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SIGN IN  (also used after registration redirect)
// ─────────────────────────────────────────────────────────────────────────────
const SignInScreen = ({onLogin,goSignUp,prefillEmail=""}) => {
  const [f,setF]       = useState({email:prefillEmail,password:""});
  const [err,setErr]   = useState("");
  const [loading,setLoading] = useState(false);
  const [show,setShow] = useState(false);
  const set = k => e => setF({...f,[k]:e.target.value});

  const submit = async () => {
    if(!f.email||!f.password) return setErr("Please fill in all fields.");
    setLoading(true); setErr("");
    const users = DB.getUsers();
    const found = users.find(u=>u.email===f.email.toLowerCase().trim());
    if(!found){ setLoading(false); return setErr("No account found with this email."); }
    const pwHash = await hash(f.password);
    if(pwHash!==found.passwordHash){ setLoading(false); return setErr("Incorrect password. Please try again."); }
    // Restore transactions
    setTimeout(()=>{ setLoading(false); onLogin(found); },800);
  };

  return (
    <Screen style={{background:C.card,overflowY:"auto"}}>
      <div style={{background:`linear-gradient(160deg,${C.primary} 0%,${C.primaryDk} 100%)`,padding:"52px 24px 32px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-50,right:-50,width:160,height:160,borderRadius:"50%",background:"rgba(255,255,255,.06)"}}/>
        <div style={{width:52,height:52,background:"rgba(255,255,255,.18)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",border:"1px solid rgba(255,255,255,.25)"}}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="5" width="20" height="14" rx="3" fill="white" fillOpacity=".9"/>
            <path d="M2 10h20" stroke={C.primary} strokeWidth="2"/>
            <rect x="5" y="13" width="5" height="2" rx="1" fill={C.primary}/>
          </svg>
        </div>
        <h1 style={{color:"#fff",fontSize:22,fontWeight:800}}>PesoVault</h1>
        <p style={{color:"rgba(255,255,255,.65)",fontSize:13,marginTop:3}}>Sign in to your account</p>
      </div>

      {prefillEmail&&(
        <div style={{background:C.primaryLt,borderBottom:`1px solid ${C.border}`,padding:"10px 20px",display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:16}}>✅</span>
          <p style={{fontSize:13,color:C.primaryDk,fontWeight:600}}>Account created! Please sign in to continue.</p>
        </div>
      )}

      <div style={{padding:"24px 20px 36px",flex:1}}>
        <h2 style={{fontSize:20,fontWeight:700,marginBottom:3}}>Welcome Back</h2>
        <p style={{color:C.t3,fontSize:14,marginBottom:20}}>Enter your credentials to continue</p>

        {err&&(
          <div style={{background:"#FEF2F2",border:`1px solid #FECACA`,borderRadius:12,padding:"11px 14px",color:C.red,fontSize:13,marginBottom:14,display:"flex",gap:8,alignItems:"center"}}>
            <span>⚠️</span>{err}
          </div>
        )}

        <Field label="Email Address"><Input icon="✉️" type="email" placeholder="juan@email.com" value={f.email} onChange={set("email")}/></Field>
        <Field label="Password">
          <div style={{position:"relative"}}>
            <Input icon="🔒" type={show?"text":"password"} placeholder="Your password" value={f.password} onChange={set("password")}/>
            <button onClick={()=>setShow(v=>!v)} style={{position:"absolute",right:13,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:13,color:C.t3}}>{show?"🙈":"👁"}</button>
          </div>
        </Field>
        <div style={{textAlign:"right",marginTop:-6,marginBottom:18}}>
          <button style={{background:"none",border:"none",color:C.primary,fontSize:13,fontWeight:600,cursor:"pointer"}}>Forgot password?</button>
        </div>

        <Btn loading={loading} onClick={submit}>Sign In</Btn>
        <Divider label="New to PesoVault?"/>
        <Btn variant="outline" onClick={goSignUp}>Create Account</Btn>
      </div>
    </Screen>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TXN DETAIL MODAL
// ─────────────────────────────────────────────────────────────────────────────
const TxnDetailModal = ({txn, onClose}) => {
  if (!txn) return null;
  const isDebit = txn.type==="withdrawal"||txn.type==="keyPurchase";
  const statusColor = txn.status==="success"?C.primary:txn.status==="pending"?C.amber:txn.status==="failed"?C.red:C.t3;
  const typeLabels  = {withdrawal:"GCash Withdrawal",keyPurchase:"Activation Key Purchase",bonus:"Welcome Bonus",reward:"Reward Credit"};
  const typeIcons   = {withdrawal:"⬆️",keyPurchase:"🔑",bonus:"🎁",reward:"⭐"};

  // Parse gcashName and gcash from label e.g. "GCash · Juan dela Cruz · 09171234567"
  const parts = txn.label.split(" · ");
  const gcashName   = parts[1] || "—";
  const gcashNumber = parts[2] || "—";

  const Row = ({label, value, mono, valueColor}) => (
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"13px 0",borderBottom:`1px solid ${C.border}`}}>
      <span style={{fontSize:13,color:C.t3,fontWeight:500,flexShrink:0,marginRight:12}}>{label}</span>
      <span style={{fontSize:13,fontWeight:700,color:valueColor||C.t1,textAlign:"right",fontFamily:mono?"monospace":"inherit",letterSpacing:mono?".05em":"normal",wordBreak:"break-all"}}>{value}</span>
    </div>
  );

  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.48)",zIndex:300,animation:"fadeIn .15s"}}/>
      <div style={{
        position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",
        width:"100%",maxWidth:430,background:C.card,
        borderRadius:"22px 22px 0 0",zIndex:301,
        animation:"slideUp .22s ease",paddingBottom:32,
      }}>
        {/* Handle */}
        <div style={{width:38,height:4,background:C.border,borderRadius:4,margin:"13px auto 8px"}}/>

        {/* Header */}
        <div style={{padding:"6px 20px 18px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14}}>
            <p style={{fontWeight:800,fontSize:17}}>Transaction Details</p>
            <button onClick={onClose} style={{width:32,height:32,borderRadius:10,background:C.bg,border:"none",cursor:"pointer",fontSize:15,display:"flex",alignItems:"center",justifyContent:"center",color:C.t2}}>✕</button>
          </div>
          {/* Big amount */}
          <div style={{textAlign:"center",padding:"10px 0 4px"}}>
            <div style={{width:56,height:56,borderRadius:18,background:isDebit?"#FEF2F2":C.primaryLt,display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 12px"}}>
              {typeIcons[txn.type]||"💸"}
            </div>
            <p style={{fontSize:28,fontWeight:900,color:isDebit?C.red:C.primary,letterSpacing:"-.5px"}}>
              {txn.type==="keyPurchase" ? "External Payment" : isDebit?"−"+fmt(txn.amount):"+"+fmt(txn.amount)}
            </p>
            <p style={{fontSize:14,color:C.t2,fontWeight:600,marginTop:4}}>{typeLabels[txn.type]||"Transaction"}</p>
            <div style={{marginTop:8,display:"inline-flex",alignItems:"center",gap:6,background:statusColor+"15",borderRadius:20,padding:"5px 14px"}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:statusColor}}/>
              <span style={{fontSize:12,fontWeight:700,color:statusColor,textTransform:"capitalize"}}>{txn.status}</span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div style={{padding:"0 20px"}}>
          <Row label="Date & Time"    value={txn.date}/>
          {txn.type==="withdrawal" && <>
            <Row label="Account Name"   value={gcashName}/>
            <Row label="GCash Number"   value={gcashNumber} mono/>
          </>}
          <Row label="Type"           value={typeLabels[txn.type]||"Transaction"}/>
          <Row label="Amount"         value={fmt(txn.amount)} valueColor={isDebit?C.red:C.primary}/>
          <Row label="Status"         value={txn.status.charAt(0).toUpperCase()+txn.status.slice(1)} valueColor={statusColor}/>
          <Row label="Reference No."  value={txn.ref||txn.id} mono/>
          {txn.type==="withdrawal"&&(
            <div style={{marginTop:14,background:txn.status==="failed"?"#FEF2F2":"#FFF8E1",border:`1px solid ${txn.status==="failed"?C.red+"33":C.amber+"33"}`,borderRadius:12,padding:"12px 14px",display:"flex",gap:10}}>
              <span style={{fontSize:16}}>{txn.status==="failed"?"❌":"ℹ️"}</span>
              <p style={{fontSize:12,color:txn.status==="failed"?"#991B1B":"#92400E",lineHeight:1.6}}>
                {txn.status==="failed"
                  ? "This withdrawal was not completed. Your balance has not been deducted. Please contact support on Telegram if you have questions."
                  : "Withdrawals are manually processed. If your status shows pending, please allow 1–24 hours for processing."
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// TXN ROW
// ─────────────────────────────────────────────────────────────────────────────
const TxnRow = ({txn, onClick}) => {
  const meta = {
    withdrawal:  {icon:"⬆️",bg:"#FEF2F2"},
    keyPurchase: {icon:"🔑",bg:"#FFF8E1"},
    bonus:       {icon:"🎁",bg:C.primaryLt},
    reward:      {icon:"⭐",bg:"#F3F0FF"},
  };
  const m = meta[txn.type]||{icon:"💸",bg:C.bg};
  const isDebit = txn.type==="withdrawal"||txn.type==="keyPurchase";
  return (
    <button onClick={onClick} style={{
      width:"100%",display:"flex",alignItems:"center",gap:12,
      padding:"13px 0",borderBottom:`1px solid ${C.border}`,
      background:"none",border:"none",borderBottom:`1px solid ${C.border}`,
      cursor:"pointer",textAlign:"left",
      transition:"background .12s",
    }}
      onMouseEnter={e=>e.currentTarget.style.background=C.bg}
      onMouseLeave={e=>e.currentTarget.style.background="none"}
    >
      <div style={{width:44,height:44,borderRadius:14,background:m.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0}}>{m.icon}</div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontWeight:600,fontSize:14,color:C.t1,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{txn.label}</p>
        <p style={{fontSize:12,color:C.t3,marginTop:2}}>{txn.date}</p>
      </div>
      <div style={{textAlign:"right",flexShrink:0}}>
        <p style={{fontWeight:700,fontSize:14,color:isDebit?C.red:C.primary}}>
          {txn.type==="keyPurchase" ? "External" : isDebit?"−"+fmt(txn.amount):"+"+fmt(txn.amount)}
        </p>
        <Badge color={txn.status==="success"?C.primary:txn.status==="pending"?C.amber:txn.status==="failed"?C.red:C.t3}>{txn.status}</Badge>
      </div>
      <span style={{color:C.t4,fontSize:16,fontWeight:300,flexShrink:0}}>›</span>
    </button>
  );
};


// ─────────────────────────────────────────────────────────────────────────────
// QUICK BTN
// ─────────────────────────────────────────────────────────────────────────────
const QuickBtn = ({icon,label,bg,onClick}) => (
  <button onClick={onClick} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:7,background:"none",border:"none",cursor:"pointer"}}>
    <div style={{width:54,height:54,borderRadius:18,background:bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,transition:"transform .12s,box-shadow .12s",boxShadow:`0 2px 8px ${bg}`}}
      onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
      onMouseLeave={e=>e.currentTarget.style.transform="none"}>
      {icon}
    </div>
    <span style={{fontSize:11,fontWeight:600,color:C.t2}}>{label}</span>
  </button>
);

// ─────────────────────────────────────────────────────────────────────────────
// HOME / WALLET DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
const HomeTab = ({user,setUser,txns,setTxns,setTab}) => {
  const [showBal,setShowBal]       = useState(true);
  const [selectedTxn,setSelectedTxn] = useState(null);
  const totalIn  = txns.filter(t=>t.type==="bonus"||t.type==="reward").reduce((s,t)=>s+t.amount,0);
  const totalOut = txns.filter(t=>t.type==="withdrawal").reduce((s,t)=>s+t.amount,0);

  return (
    <div style={{flex:1,overflowY:"auto",background:C.bg,paddingBottom:8}}>

      {/* TOP NAV */}
      <div style={{background:`linear-gradient(160deg,${C.primary} 0%,${C.primaryDk} 100%)`,padding:"50px 20px 18px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-60,right:-50,width:200,height:200,borderRadius:"50%",background:"rgba(255,255,255,.05)"}}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",position:"relative"}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:42,height:42,borderRadius:14,background:"rgba(255,255,255,.2)",display:"flex",alignItems:"center",justifyContent:"center",color:"#fff",fontWeight:800,fontSize:14,border:"1.5px solid rgba(255,255,255,.28)"}}>
              {initials(user.name)}
            </div>
            <div>
              <p style={{color:"rgba(255,255,255,.55)",fontSize:11}}>Welcome back 👋</p>
              <p style={{color:"#fff",fontSize:15,fontWeight:700}}>{user.name.split(" ")[0]}</p>
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button style={{width:38,height:38,borderRadius:12,background:"rgba(255,255,255,.18)",border:"1px solid rgba(255,255,255,.22)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16}}>🔔</button>
            <button style={{width:38,height:38,borderRadius:12,background:"rgba(255,255,255,.18)",border:"1px solid rgba(255,255,255,.22)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16}}>⚙️</button>
          </div>
        </div>
      </div>

      {/* WALLET CARD */}
      <div style={{padding:"0 16px"}}>
        <div style={{
          background:`linear-gradient(135deg,${C.accent} 0%,${C.primaryDk} 45%,${C.primaryMd} 100%)`,
          borderRadius:22,padding:"22px 20px 18px",
          boxShadow:`0 10px 36px rgba(0,62,128,.28)`,
          position:"relative",overflow:"hidden",marginTop:0,
        }}>
          {/* Decorative rings */}
          <div style={{position:"absolute",top:-40,right:-40,width:180,height:180,borderRadius:"50%",border:"1px solid rgba(255,255,255,.08)"}}/>
          <div style={{position:"absolute",top:-20,right:-20,width:120,height:120,borderRadius:"50%",border:"1px solid rgba(255,255,255,.06)"}}/>
          <div style={{position:"absolute",bottom:-50,left:-30,width:150,height:150,borderRadius:"50%",background:"rgba(255,255,255,.04)"}}/>

          {/* Card header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
            <div style={{display:"flex",alignItems:"center",gap:7,background:"rgba(255,255,255,.12)",borderRadius:8,padding:"4px 10px"}}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <rect x="2" y="5" width="20" height="14" rx="3" fill="white" fillOpacity=".9"/>
                <path d="M2 10h20" stroke={C.primaryDk} strokeWidth="2"/>
              </svg>
              <span style={{color:"#fff",fontWeight:800,fontSize:12,letterSpacing:".02em"}}>PesoVault</span>
            </div>
            <button onClick={()=>setShowBal(v=>!v)} style={{
              background:"rgba(255,255,255,.15)",border:"1px solid rgba(255,255,255,.22)",
              borderRadius:8,padding:"5px 11px",color:"rgba(255,255,255,.85)",
              fontSize:11,cursor:"pointer",fontWeight:600,display:"flex",alignItems:"center",gap:4,
            }}>
              {showBal?"🙈 Hide":"👁 Show"}
            </button>
          </div>

          {/* Chip */}
          <div style={{width:36,height:26,borderRadius:5,background:"linear-gradient(135deg,#E8C547,#B89A20)",marginBottom:14,display:"grid",gridTemplateColumns:"1fr 1fr",gap:2,padding:4}}>
            {[0,1,2,3].map(i=><div key={i} style={{background:"rgba(255,255,255,.22)",borderRadius:2}}/>)}
          </div>

          {/* Balance */}
          <p style={{color:"rgba(255,255,255,.55)",fontSize:10,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:4}}>Wallet Balance</p>
          <p style={{color:"#fff",fontSize:30,fontWeight:900,letterSpacing:"-1px",marginBottom:2}}>
            {showBal ? fmt(user.balance) : "₱ ••• •••••"}
          </p>

          {/* Footer */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",marginTop:16}}>
            <div>
              <p style={{color:"rgba(255,255,255,.45)",fontSize:9,letterSpacing:".08em",marginBottom:2}}>ACCOUNT HOLDER</p>
              <p style={{color:"rgba(255,255,255,.9)",fontSize:12,fontWeight:700,letterSpacing:".04em"}}>{user.name.toUpperCase()}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{color:"rgba(255,255,255,.45)",fontSize:9,letterSpacing:".08em",marginBottom:2}}>CURRENCY</p>
              <p style={{color:"rgba(255,255,255,.9)",fontSize:12,fontWeight:700}}>PHP</p>
            </div>
          </div>
          {/* Mastercard-style circles */}
          <div style={{position:"absolute",bottom:18,right:18,display:"flex"}}>
            <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,200,0,.5)"}}/>
            <div style={{width:30,height:30,borderRadius:"50%",background:"rgba(255,80,0,.4)",marginLeft:-14}}/>
          </div>
        </div>
      </div>

      {/* INCOME / EXPENSE */}
      <div style={{display:"flex",gap:12,padding:"14px 16px 0"}}>
        <div style={{flex:1,background:C.card,borderRadius:16,padding:"14px 15px",boxShadow:`0 1px 5px ${C.shadow}`}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
            <div style={{width:30,height:30,borderRadius:10,background:C.primaryLt,display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⬇️</div>
            <p style={{fontSize:12,color:C.t3,fontWeight:600}}>Income</p>
          </div>
          <p style={{fontSize:17,fontWeight:800,color:C.primary}}>{fmt(totalIn)}</p>
          <p style={{fontSize:11,color:C.t3,marginTop:2}}>Total credits</p>
        </div>
        <div style={{flex:1,background:C.card,borderRadius:16,padding:"14px 15px",boxShadow:`0 1px 5px ${C.shadow}`}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:8}}>
            <div style={{width:30,height:30,borderRadius:10,background:"#FEF2F2",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14}}>⬆️</div>
            <p style={{fontSize:12,color:C.t3,fontWeight:600}}>Spent</p>
          </div>
          <p style={{fontSize:17,fontWeight:800,color:C.red}}>{fmt(totalOut)}</p>
          <p style={{fontSize:11,color:C.t3,marginTop:2}}>Total debits</p>
        </div>
      </div>

      {/* QUICK ACTIONS */}
      <div style={{margin:"14px 16px 0",background:C.card,borderRadius:20,padding:"16px 10px",boxShadow:`0 1px 5px ${C.shadow}`}}>
        <p style={{fontSize:10,fontWeight:700,color:C.t3,marginBottom:14,paddingLeft:6,textTransform:"uppercase",letterSpacing:".08em"}}>Quick Actions</p>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <QuickBtn icon="⬆️" label="Withdraw" bg="#E6F0FF" onClick={()=>setTab("withdraw_modal")}/>
          <QuickBtn icon="🔑" label="Buy Key"  bg="#FFF8E1" onClick={()=>setTab("buykey")}/>
          <QuickBtn icon="⭐" label="Rewards"  bg="#F3F0FF" onClick={()=>setTab("reward")}/>
          <QuickBtn icon="📋" label="History"  bg="#F0F4FA" onClick={()=>{}}/>
        </div>
      </div>

      {/* WALLET USAGE */}
      <div style={{margin:"14px 16px 0",background:C.card,borderRadius:18,padding:"16px 18px",boxShadow:`0 1px 5px ${C.shadow}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:11}}>
          <p style={{fontWeight:700,fontSize:14}}>Wallet Usage</p>
          <span style={{fontSize:12,color:C.t3}}>{totalOut>0?((totalOut/INIT_BALANCE)*100).toFixed(1):0}% used</span>
        </div>
        <div style={{height:8,background:C.border,borderRadius:8,overflow:"hidden",marginBottom:9}}>
          <div style={{height:"100%",width:`${Math.min(100,(totalOut/INIT_BALANCE)*100)}%`,background:`linear-gradient(90deg,${C.primary},${C.primaryDk})`,borderRadius:8,transition:"width .6s ease"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between"}}>
          <span style={{fontSize:11,color:C.t3}}>Spent <strong style={{color:C.t1}}>{fmt(totalOut)}</strong></span>
          <span style={{fontSize:11,color:C.t3}}>Remaining <strong style={{color:C.primary}}>{fmt(user.balance)}</strong></span>
        </div>
      </div>

      {/* TRANSACTIONS */}
      <div style={{padding:"14px 16px 16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p style={{fontWeight:700,fontSize:15}}>Recent Transactions</p>
          <button style={{background:"none",border:"none",color:C.primary,fontSize:13,fontWeight:600,cursor:"pointer"}}>See all</button>
        </div>
        <Card style={{padding:"0 16px"}}>
          {txns.length===0
            ? <div style={{textAlign:"center",padding:"26px 0"}}>
                <div style={{fontSize:38,marginBottom:10}}>📭</div>
                <p style={{fontWeight:600,color:C.t2,fontSize:14}}>No transactions yet</p>
                <p style={{color:C.t3,fontSize:12,marginTop:4}}>Your activity will appear here</p>
              </div>
            : txns.slice(0,6).map(t=><TxnRow key={t.id} txn={t} onClick={()=>setSelectedTxn(t)}/>)
          }
        </Card>
      </div>

      {selectedTxn && <TxnDetailModal txn={selectedTxn} onClose={()=>setSelectedTxn(null)}/>}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// REWARDS TAB
// ─────────────────────────────────────────────────────────────────────────────
const RewardCard = ({icon,title,desc,points,earned}) => (
  <Card style={{marginBottom:12,display:"flex",alignItems:"center",gap:13}}>
    <div style={{width:48,height:48,borderRadius:15,background:earned?C.primaryLt:"#F3F4F6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,flexShrink:0}}>{icon}</div>
    <div style={{flex:1}}>
      <p style={{fontWeight:600,fontSize:14,color:C.t1}}>{title}</p>
      <p style={{fontSize:12,color:C.t3,marginTop:2}}>{desc}</p>
    </div>
    <div style={{textAlign:"right",flexShrink:0}}>
      <p style={{fontSize:13,fontWeight:700,color:earned?C.primary:C.t3}}>+{points} pts</p>
      {earned?<Badge color={C.primary}>Earned</Badge>:<Badge color={C.t3}>Pending</Badge>}
    </div>
  </Card>
);

const RewardsTab = ({user,txns}) => {
  const totalPts = 2500 + txns.filter(t=>t.type==="withdrawal").length*150;
  const tier = totalPts>=5000?"Gold":totalPts>=2000?"Silver":"Bronze";
  const tierMeta = {Bronze:{color:"#CD7F32",bg:"#FFF1E6",emoji:"🥉"},Silver:{color:"#888",bg:"#F3F4F6",emoji:"🥈"},Gold:{color:"#F59E0B",bg:"#FFF8E1",emoji:"🥇"}};
  const {color:tc,bg:tbg,emoji} = tierMeta[tier];
  const progress = Math.min(100,(totalPts/5000)*100);
  return (
    <div style={{flex:1,overflowY:"auto",paddingBottom:16}}>
      <div style={{background:`linear-gradient(160deg,${C.primary},${C.primaryDk})`,padding:"50px 20px 22px"}}>
        <p style={{color:"rgba(255,255,255,.6)",fontSize:13}}>Reward Points</p>
        <p style={{color:"#fff",fontSize:38,fontWeight:900,letterSpacing:"-.5px"}}>{totalPts.toLocaleString()}</p>
        <p style={{color:"rgba(255,255,255,.55)",fontSize:12,marginTop:2}}>points earned</p>
      </div>
      <div style={{padding:"16px 16px 0"}}>
        <Card style={{marginBottom:16,background:`linear-gradient(135deg,${tbg},${C.card})`}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:13}}>
            <div>
              <p style={{fontSize:12,color:C.t3}}>Current Tier</p>
              <p style={{fontSize:20,fontWeight:800,color:tc}}>{tier}</p>
            </div>
            <div style={{width:50,height:50,borderRadius:16,background:tc+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>{emoji}</div>
          </div>
          <p style={{fontSize:12,color:C.t3,marginBottom:7}}>Progress to Gold · {totalPts.toLocaleString()} / 5,000 pts</p>
          <div style={{height:8,background:C.border,borderRadius:8,overflow:"hidden"}}>
            <div style={{height:"100%",width:`${progress}%`,background:`linear-gradient(90deg,${C.primary},${C.amber})`,borderRadius:8,transition:"width .5s ease"}}/>
          </div>
        </Card>
        <p style={{fontWeight:700,fontSize:15,marginBottom:12}}>Your Achievements</p>
        <RewardCard icon="🎁" title="Welcome Bonus" desc="Created your PesoVault account" points={500} earned={true}/>
        <RewardCard icon="⬆️" title="First Withdrawal" desc="Complete your first withdrawal" points={150} earned={txns.some(t=>t.type==="withdrawal")}/>
        <RewardCard icon="🔑" title="Key Buyer" desc="Purchase an activation key" points={100} earned={txns.some(t=>t.type==="keyPurchase")}/>
        <RewardCard icon="👥" title="Refer a Friend" desc="Invite someone to PesoVault" points={500} earned={false}/>
        <RewardCard icon="💎" title="Power User" desc="Make 5 withdrawals" points={1000} earned={txns.filter(t=>t.type==="withdrawal").length>=5}/>
        <Card style={{textAlign:"center",marginTop:4,background:C.primaryLt}}>
          <div style={{fontSize:34,marginBottom:10}}>🎯</div>
          <p style={{fontWeight:700,fontSize:15,marginBottom:4}}>Redeem Points</p>
          <p style={{color:C.t3,fontSize:13,marginBottom:14,lineHeight:1.6}}>Coming soon — redeem for cash rewards and fee discounts.</p>
          <Btn variant="outline" style={{maxWidth:200,margin:"0 auto"}}>Join Waitlist</Btn>
        </Card>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BUY KEY TAB  — Telegram payment flow
// ─────────────────────────────────────────────────────────────────────────────
const TELEGRAM_USERNAME = "bayanhanaidfund";
const TELEGRAM_URL      = `https://t.me/${TELEGRAM_USERNAME}`;

const TelegramIcon = ({size=22,color="#fff"}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="12" fill="#29A8E0"/>
    <path d="M5.5 11.8l3.7 1.4 1.4 4.4 2-2.6 4.2 3.1 2.7-10.6L5.5 11.8z" fill={color}/>
    <path d="M9.2 13.2l.4 3.4 1.4-2.6" fill="#C8DAEA"/>
    <path d="M9.2 13.2l7.3-4.6-5.9 6.2" fill="#A9C9DD"/>
  </svg>
);

const BuyKeyTab = ({user,txns,setTxns,showToast}) => {
  const [step,setStep]               = useState("idle");
  const [key,setKey]                 = useState("");
  const [copied,setCopied]           = useState(false);
  const [refCode]                    = useState("PV-"+uid());
  const [manualKey,setManualKey]     = useState("");
  const [manualKeyErr,setManualKeyErr] = useState("");

  const openTelegram = () => {
    const msg = encodeURIComponent(
      `Hi! I'd like to buy a PesoVault Activation Key.\n\nRef: ${refCode}\nAmount: ₱1,000\nEmail: ${user.email}\n\nPlease confirm payment and send me my key. Thank you!`
    );
    window.open(`${TELEGRAM_URL}?text=${msg}`, "_blank", "noopener");
    setStep("awaiting");
  };

  const submitManualKey = () => {
    const trimmed = manualKey.trim();
    if(!/^\d{4}-\d{4}-\d{4}-\d{4}$/.test(trimmed)){
      setManualKeyErr("Invalid format. Key should look like: XXXX-XXXX-XXXX-XXXX");
      return;
    }
    setKey(trimmed);
    const newTxn = {id:uid(),type:"keyPurchase",label:"Activation Key Purchase",amount:0,date:today(),status:"success",ref:refCode};
    setTxns(prev=>{ const updated=[newTxn,...prev]; DB.saveTxns(user.email,updated); return updated; });
    showToast("Key saved! Use it to withdraw.","success");
    setStep("done");
  };

  const copyKey = () => { navigator.clipboard?.writeText(key).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2200);}); };
  const copyRef = () => { navigator.clipboard?.writeText(refCode); showToast("Reference copied!","info"); };

  return (
    <div style={{flex:1,overflowY:"auto",paddingBottom:20}}>

      {/* Header */}
      <div style={{background:`linear-gradient(160deg,${C.primary},${C.primaryDk})`,padding:"50px 20px 22px",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-40,right:-40,width:140,height:140,borderRadius:"50%",background:"rgba(255,255,255,.05)"}}/>
        <p style={{color:"rgba(255,255,255,.6)",fontSize:13,marginBottom:2}}>Activation Key</p>
        <p style={{color:"#fff",fontSize:20,fontWeight:800}}>Unlock Withdrawals</p>
      </div>

      <div style={{padding:"16px"}}>

        {/* ── IDLE: show product + CTA ── */}
        {step==="idle" && (
          <>
            {/* Price card */}
            <Card style={{background:`linear-gradient(135deg,${C.accent},${C.primaryDk},${C.primaryMd})`,marginBottom:16,textAlign:"center",padding:"28px 20px"}}>
              <div style={{width:64,height:64,background:"rgba(255,255,255,.16)",borderRadius:22,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:30}}>🔑</div>
              <p style={{color:"rgba(255,255,255,.65)",fontSize:13,marginBottom:3}}>One-time price</p>
              <p style={{color:"#fff",fontSize:42,fontWeight:900,letterSpacing:"-1px"}}>₱1,000</p>
              <p style={{color:"rgba(255,255,255,.5)",fontSize:12,marginTop:5}}>Pay via Telegram · Instant key after confirmation</p>
            </Card>

            {/* Steps */}
            <Card style={{marginBottom:16}}>
              <p style={{fontWeight:700,fontSize:14,marginBottom:14}}>How it works</p>
              {[
                {n:"1",icon:"📲",t:"Open Telegram",d:"Tap the button below to message our agent"},
                {n:"2",icon:"💸",t:"Send Payment",d:"Pay ₱1,000 and share your reference code"},
                {n:"3",icon:"✅",t:"Confirm Here",d:"Come back and tap \"I've Paid\" to get your key"},
                {n:"4",icon:"🔓",t:"Withdraw",d:"Use the key in the Withdrawal page"},
              ].map((s,i)=>(
                <div key={i} style={{display:"flex",gap:12,padding:"11px 0",borderBottom:i<3?`1px solid ${C.border}`:"none",alignItems:"flex-start"}}>
                  <div style={{width:36,height:36,borderRadius:12,background:C.primaryLt,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <span style={{fontSize:16}}>{s.icon}</span>
                  </div>
                  <div style={{flex:1}}>
                    <p style={{fontWeight:700,fontSize:13,color:C.t1}}>{s.t}</p>
                    <p style={{fontSize:12,color:C.t3,marginTop:2,lineHeight:1.5}}>{s.d}</p>
                  </div>
                  <div style={{width:22,height:22,borderRadius:"50%",background:C.primary,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:11,fontWeight:800,color:"#fff"}}>{s.n}</div>
                </div>
              ))}
            </Card>

            {/* Ref code */}
            <Card style={{marginBottom:16,background:C.primaryLt,border:`1px solid ${C.primary}22`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <p style={{fontSize:12,fontWeight:700,color:C.primaryDk}}>Your Reference Code</p>
                <button onClick={copyRef} style={{background:"none",border:"none",color:C.primary,fontSize:12,fontWeight:700,cursor:"pointer"}}>Copy</button>
              </div>
              <p style={{fontFamily:"monospace",fontSize:16,fontWeight:800,color:C.accent,letterSpacing:".08em"}}>{refCode}</p>
              <p style={{fontSize:11,color:C.t3,marginTop:5}}>Include this code when messaging the agent so we can verify your payment.</p>
            </Card>

            {/* Telegram button */}
            <button onClick={openTelegram} style={{
              width:"100%",padding:"15px 20px",borderRadius:14,border:"none",cursor:"pointer",
              background:"linear-gradient(135deg,#229ED9,#1A7DB5)",
              display:"flex",alignItems:"center",justifyContent:"center",gap:10,
              boxShadow:"0 4px 16px rgba(34,158,217,.4)",
              transition:"opacity .15s,transform .1s",
            }}
              onMouseEnter={e=>{e.currentTarget.style.opacity=".9";e.currentTarget.style.transform="translateY(-1px)";}}
              onMouseLeave={e=>{e.currentTarget.style.opacity="1";e.currentTarget.style.transform="translateY(0)";}}
              onMouseDown={e=>e.currentTarget.style.transform="scale(.98)"}
              onMouseUp={e=>e.currentTarget.style.transform="translateY(-1px)"}
            >
              <TelegramIcon size={22}/>
              <span style={{color:"#fff",fontWeight:700,fontSize:15}}>Pay via Telegram</span>
              <span style={{color:"rgba(255,255,255,.7)",fontSize:13}}>@{TELEGRAM_USERNAME}</span>
            </button>
            <p style={{textAlign:"center",fontSize:11,color:C.t3,marginTop:10}}>
              You'll be redirected to Telegram to message our payment agent.
            </p>
          </>
        )}

        {/* ── AWAITING: paste key received from Telegram ── */}
        {step==="awaiting" && (
          <div style={{animation:"slideUp .25s ease"}}>

            {/* Status banner */}
            <div style={{background:"#FFF8E1",border:`1.5px solid ${C.amber}44`,borderRadius:20,padding:"22px 20px",textAlign:"center",marginBottom:16}}>
              <div style={{fontSize:40,marginBottom:10}}>💬</div>
              <p style={{fontWeight:800,fontSize:17,color:"#92400E",marginBottom:6}}>Waiting for Your Key</p>
              <p style={{fontSize:13,color:"#B45309",lineHeight:1.8}}>
                Our agent will verify your payment and <strong>send you an activation key</strong> on Telegram. Paste it in the field below once you receive it.
              </p>
            </div>

            {/* Steps */}
            <Card style={{marginBottom:16}}>
              <p style={{fontWeight:700,fontSize:13,marginBottom:12}}>What to do next</p>
              {[
                {icon:"1️⃣",text:"Send your payment proof + reference code to our Telegram agent"},
                {icon:"2️⃣",text:"Wait for the agent to verify and reply with your activation key"},
                {icon:"3️⃣",text:"Copy the key from Telegram and paste it in the field below"},
              ].map((s,i)=>(
                <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start",padding:"9px 0",borderBottom:i<2?`1px solid ${C.border}`:"none"}}>
                  <span style={{fontSize:18,flexShrink:0}}>{s.icon}</span>
                  <p style={{fontSize:13,color:C.t2,lineHeight:1.6}}>{s.text}</p>
                </div>
              ))}
            </Card>

            {/* Ref code */}
            <Card style={{marginBottom:16,background:C.primaryLt,border:`1px solid ${C.primary}22`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                <p style={{fontSize:12,fontWeight:700,color:C.primaryDk}}>Your Reference Code</p>
                <button onClick={copyRef} style={{background:"none",border:"none",color:C.primary,fontSize:12,fontWeight:700,cursor:"pointer"}}>Copy</button>
              </div>
              <p style={{fontFamily:"monospace",fontSize:16,fontWeight:800,color:C.accent,letterSpacing:".1em",marginBottom:5}}>{refCode}</p>
              <p style={{fontSize:11,color:C.t3}}>Send this to the agent so they can verify your payment quickly.</p>
            </Card>

            {/* Agent card */}
            <Card style={{marginBottom:16,display:"flex",alignItems:"center",gap:14}}>
              <div style={{width:50,height:50,borderRadius:16,background:"#E8F5FF",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                <TelegramIcon size={28}/>
              </div>
              <div style={{flex:1}}>
                <p style={{fontWeight:700,fontSize:14}}>BayanHana Aid Fund</p>
                <p style={{fontSize:13,color:"#229ED9",fontWeight:600,marginTop:1}}>@{TELEGRAM_USERNAME}</p>
                <p style={{fontSize:11,color:C.t3,marginTop:2}}>Available 24/7 · Usually replies within minutes</p>
              </div>
              <button onClick={openTelegram} style={{background:"#E8F5FF",border:"none",borderRadius:10,padding:"8px 12px",color:"#229ED9",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>Open</button>
            </Card>

            {/* Key paste input */}
            <Card style={{marginBottom:16}}>
              <p style={{fontWeight:700,fontSize:14,marginBottom:3}}>Paste Key from Telegram</p>
              <p style={{fontSize:12,color:C.t3,marginBottom:14,lineHeight:1.6}}>Once the agent sends you the key on Telegram, paste it here to activate it.</p>
              <Field error={manualKeyErr}>
                <Input
                  icon="🔑"
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  value={manualKey}
                  onChange={e=>{ setManualKey(e.target.value); setManualKeyErr(""); }}
                  error={manualKeyErr}
                  style={{fontFamily:"monospace",letterSpacing:".1em",fontSize:14}}
                />
              </Field>
              <Btn onClick={submitManualKey} disabled={!manualKey.trim()} style={{marginTop:4}}>
                ✅ Activate Key
              </Btn>
            </Card>

            <button onClick={()=>setStep("idle")} style={{width:"100%",background:"none",border:"none",color:C.t3,fontSize:13,cursor:"pointer",padding:"8px"}}>
              ← Cancel, go back
            </button>
          </div>
        )}

        {/* ── DONE: key activated ── */}
        {step==="done" && (
          <div style={{animation:"slideUp .3s ease"}}>
            <div style={{background:C.primaryLt,border:`1.5px solid ${C.primary}33`,borderRadius:20,padding:"26px 20px",textAlign:"center",marginBottom:16}}>
              <div style={{width:62,height:62,background:C.primary,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 14px",fontSize:26,color:"#fff",fontWeight:800}}>✓</div>
              <p style={{color:C.primary,fontWeight:800,fontSize:18}}>Key Activated!</p>
              <p style={{color:C.t3,fontSize:13,marginTop:5}}>Your key is saved and ready to use for withdrawal.</p>
            </div>

            <Card style={{marginBottom:16}}>
              <p style={{fontSize:11,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:12}}>Your Activation Key</p>
              <div style={{background:C.bg,borderRadius:13,padding:"18px 14px",textAlign:"center",border:`2px dashed ${C.primary}44`,marginBottom:14}}>
                <p style={{fontFamily:"monospace",fontSize:21,fontWeight:800,letterSpacing:".16em",color:C.primaryDk,wordBreak:"break-all"}}>{key}</p>
              </div>
              <Btn onClick={copyKey} variant={copied?"primary":"outline"} icon={copied?"✓":"📋"}>
                {copied?"Copied to clipboard!":"Copy Key"}
              </Btn>
            </Card>

            <Card style={{background:"#FFF8E1",border:`1px solid ${C.amber}44`,marginBottom:16}}>
              <div style={{display:"flex",gap:11}}>
                <span style={{fontSize:18}}>💡</span>
                <div>
                  <p style={{fontWeight:700,fontSize:13,color:"#92400E"}}>How to use your key</p>
                  <p style={{fontSize:12,color:"#B45309",marginTop:3,lineHeight:1.7}}>
                    Go to <strong>Home → Withdraw</strong>, enter your GCash number & amount, then paste this key in the Activation Key field and confirm.
                  </p>
                </div>
              </div>
            </Card>

            <Btn variant="white" icon="🔑" onClick={()=>{setStep("idle");setKey("");}}>Buy Another Key</Btn>
          </div>
        )}

      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE TAB
// ─────────────────────────────────────────────────────────────────────────────
const ProfileRow = ({icon,label,value,onClick,danger}) => (
  <button onClick={onClick||undefined} style={{width:"100%",display:"flex",alignItems:"center",gap:13,padding:"13px 0",background:"none",border:"none",borderBottom:`1px solid ${C.border}`,cursor:onClick?"pointer":"default",textAlign:"left"}}>
    <div style={{width:38,height:38,borderRadius:12,background:danger?"#FEF2F2":C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontSize:17,flexShrink:0}}>{icon}</div>
    <div style={{flex:1}}>
      <p style={{fontSize:14,fontWeight:600,color:danger?C.red:C.t1}}>{label}</p>
      {value&&<p style={{fontSize:12,color:C.t3,marginTop:1}}>{value}</p>}
    </div>
    {onClick&&<span style={{color:C.t3,fontSize:18,fontWeight:300}}>›</span>}
  </button>
);

const ProfileTab = ({user,onLogout}) => (
  <div style={{flex:1,overflowY:"auto",paddingBottom:16}}>
    <div style={{background:`linear-gradient(160deg,${C.primary},${C.primaryDk})`,padding:"50px 20px 26px",textAlign:"center"}}>
      <div style={{width:78,height:78,borderRadius:26,background:"rgba(255,255,255,.22)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",color:"#fff",fontWeight:800,fontSize:26}}>{initials(user.name)}</div>
      <p style={{color:"#fff",fontSize:18,fontWeight:800}}>{user.name}</p>
      <p style={{color:"rgba(255,255,255,.6)",fontSize:13,marginTop:3}}>{user.email}</p>
      <div style={{marginTop:11,display:"inline-flex",alignItems:"center",gap:5,background:"rgba(255,255,255,.16)",borderRadius:20,padding:"5px 13px"}}>
        <span style={{color:"#fff",fontSize:13}}>✓</span>
        <span style={{color:"#fff",fontSize:12,fontWeight:600}}>Verified Account</span>
      </div>
    </div>
    <div style={{padding:"16px 16px 0"}}>
      <p style={{fontSize:10,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}}>Account</p>
      <Card style={{padding:"0 16px",marginBottom:16}}>
        <ProfileRow icon="👤" label="Full Name" value={user.name} onClick={()=>{}}/>
        <ProfileRow icon="✉️" label="Email" value={user.email} onClick={()=>{}}/>
        <ProfileRow icon="📱" label="Phone Number" value="Not set" onClick={()=>{}}/>
        <ProfileRow icon="🪪" label="Verify Identity" value="Upload valid ID" onClick={()=>{}}/>
      </Card>
      <p style={{fontSize:10,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}}>Security</p>
      <Card style={{padding:"0 16px",marginBottom:16}}>
        <ProfileRow icon="🔒" label="Change Password" onClick={()=>{}}/>
        <ProfileRow icon="🔐" label="Two-Factor Auth" value="Disabled" onClick={()=>{}}/>
        <ProfileRow icon="📲" label="Login Activity" onClick={()=>{}}/>
      </Card>
      <p style={{fontSize:10,fontWeight:700,color:C.t3,textTransform:"uppercase",letterSpacing:".08em",marginBottom:10}}>Support</p>
      <Card style={{padding:"0 16px",marginBottom:16}}>
        <ProfileRow icon="❓" label="Help Center" onClick={()=>{}}/>
        <ProfileRow icon="💬" label="Live Chat" value="Available 24/7" onClick={()=>{}}/>
        <ProfileRow icon="📋" label="Terms & Privacy" onClick={()=>{}}/>
      </Card>
      <Card style={{marginBottom:16,textAlign:"center",padding:"11px 16px"}}>
        <p style={{fontSize:12,color:C.t3}}>PesoVault v1.0.0 · Member since {new Date(user.createdAt||Date.now()).toLocaleDateString("en-PH",{month:"long",year:"numeric"})}</p>
      </Card>
      <Btn variant="danger" icon="🚪" onClick={onLogout}>Sign Out</Btn>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// WITHDRAW MODAL
// ─────────────────────────────────────────────────────────────────────────────
const WithdrawModal = ({user,setUser,txns,setTxns,onClose,showToast,setTab}) => {
  const [f,setF]       = useState({gcashName:user.name,gcash:"",amount:"",key:""});
  const [e,setE]       = useState({});
  const [loading,setLoading] = useState(false);
  const set = k => ev => setF({...f,[k]:ev.target.value});

  const validate = () => {
    const err={};
    if(!f.gcashName.trim()||f.gcashName.trim().split(" ").length<2) err.gcashName="Enter the full name registered on GCash (first & last)";
    if(!/^\d{11}$/.test(f.gcash)) err.gcash="Must be an 11-digit GCash number";
    if(!f.amount||isNaN(f.amount)||+f.amount<=0) err.amount="Enter a valid amount";
    else if(+f.amount>user.balance) err.amount="Insufficient balance";
    else if(+f.amount<100) err.amount="Minimum withdrawal is ₱100";
    if(!/^\d{4}-\d{4}-\d{4}-\d{4}$/.test(f.key)) err.key="Invalid key — format: XXXX-XXXX-XXXX-XXXX";
    setE(err); return !Object.keys(err).length;
  };

  const submit = () => {
    if(!validate()) return;
    setLoading(true);
    setTimeout(()=>{
      const newBal = user.balance - +f.amount;
      DB.updateBalance(user.email, newBal);
      setUser(u=>({...u,balance:newBal}));
      const failAfterMs = (2 + Math.random() * 3) * 60 * 60 * 1000; // 2–5 hours
      const newTxn={id:uid(),type:"withdrawal",label:`GCash · ${f.gcashName} · ${f.gcash}`,amount:+f.amount,date:today(),status:"pending",ref:"WD-"+uid(),failAt:Date.now()+failAfterMs};
      setTxns(prev=>{ const updated=[newTxn,...prev]; DB.saveTxns(user.email,updated); return updated; });
      setLoading(false);
      showToast(`${fmt(+f.amount)} sent to GCash ${f.gcash}`,"success");
      onClose();
    },1400);
  };

  return (
    <>
      <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.44)",zIndex:200,animation:"fadeIn .18s"}}/>
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:430,
        background:C.card,borderRadius:"22px 22px 0 0",zIndex:201,animation:"slideUp .25s ease",
        overflowY:"auto",maxHeight:"92vh",paddingBottom:28}}>
        <div style={{width:38,height:4,background:C.border,borderRadius:4,margin:"13px auto 0"}}/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"15px 20px 0"}}>
          <p style={{fontWeight:800,fontSize:18}}>Withdraw to GCash</p>
          <button onClick={onClose} style={{width:32,height:32,borderRadius:10,background:C.bg,border:"none",cursor:"pointer",fontSize:16,display:"flex",alignItems:"center",justifyContent:"center",color:C.t2}}>✕</button>
        </div>
        <div style={{margin:"13px 20px",background:C.primaryLt,borderRadius:13,padding:"12px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span style={{fontSize:13,color:C.primaryDk,fontWeight:600}}>Available Balance</span>
          <span style={{fontSize:16,fontWeight:800,color:C.primary}}>{fmt(user.balance)}</span>
        </div>
        <div style={{padding:"0 20px"}}>
          <Field label="GCash Account Name" error={e.gcashName} hint="Full name registered on GCash">
            <Input icon="👤" placeholder="Juan dela Cruz" value={f.gcashName} onChange={set("gcashName")} error={e.gcashName}/>
          </Field>
          <Field label="GCash Number" error={e.gcash}><Input icon="📱" placeholder="09XXXXXXXXX" value={f.gcash} onChange={set("gcash")} error={e.gcash} inputMode="numeric" maxLength={11}/></Field>
          <Field label="Amount (₱)" error={e.amount} hint="Minimum: ₱100"><Input icon="💰" type="number" placeholder="0.00" value={f.amount} onChange={set("amount")} error={e.amount} suffix="PHP"/></Field>
          <div style={{display:"flex",gap:8,marginTop:-6,marginBottom:14}}>
            {[1000,5000,10000,50000].map(v=>(
              <button key={v} onClick={()=>setF({...f,amount:String(v)})} style={{flex:1,padding:"8px 3px",borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",
                background:f.amount===String(v)?C.primary:C.bg,color:f.amount===String(v)?"#fff":C.t2,
                border:`1px solid ${f.amount===String(v)?C.primary:C.border}`,transition:"all .12s"}}>
                {fmtShort(v)}
              </button>
            ))}
          </div>
          <Field label="Activation Key" error={e.key} hint="No key? Buy one from the Key tab.">
            <Input icon="🔑" placeholder="xxxx-xxxx-xxxx" value={f.key} onChange={set("key")} error={e.key} style={{fontFamily:"monospace",letterSpacing:".08em"}}/>
          </Field>
          <button onClick={()=>{onClose();setTab("buykey");}} style={{background:"none",border:"none",color:C.primary,fontSize:13,fontWeight:600,cursor:"pointer",marginBottom:14,display:"flex",alignItems:"center",gap:4}}>
            🔑 Need a key? Buy one →
          </button>
          <Btn loading={loading} onClick={submit}>Confirm Withdrawal</Btn>
          <p style={{textAlign:"center",fontSize:11,color:C.t3,marginTop:10}}>Withdrawals are processed instantly to your GCash wallet.</p>
        </div>
      </div>
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// APP ROOT
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [page,   setPage]   = useState("loading"); // loading | splash | signup | login | app
  const [tab,    setTabRaw] = useState("home");
  const [user,   setUser]   = useState(null);
  const [txns,   setTxns]   = useState([]);
  const [toast,  setToast]  = useState(null);
  // email to prefill on login after signup
  const [prefillEmail, setPrefillEmail] = useState("");

  const showToast = (msg,type="success") => {
    setToast({msg,type});
    setTimeout(()=>setToast(null),3000);
  };

  // ── Restore session on app open ──
  useEffect(()=>{
    const savedEmail = DB.getSession();
    if(!savedEmail){
      // New visitor — show splash then signup
      setPage("splash");
      return;
    }
    const users = DB.getUsers();
    const found = users.find(u=>u.email===savedEmail);
    if(!found){ DB.clearSession(); setPage("splash"); return; }
    // Returning user — restore session silently, skip splash
    const savedTxns = DB.getTxns(found.email);
    const { txns: resolvedTxns, newBalance } = applyAutoFail(savedTxns, found.email, found);
    const finalUser = newBalance !== null ? {...found, balance: newBalance} : found;
    setUser(finalUser);
    setTxns(resolvedTxns);
    setPage("app");
    setTabRaw("home");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // Check and flip any pending txns that have passed their failAt time
  const applyAutoFail = (txnList, email, currentUser) => {
    const now = Date.now();
    let changed = false;
    let refundTotal = 0;
    const updated = txnList.map(t => {
      if(t.type==="withdrawal" && t.status==="pending" && t.failAt && now >= t.failAt){
        changed = true;
        refundTotal += t.amount;
        return {...t, status:"failed"};
      }
      return t;
    });
    if(changed){
      DB.saveTxns(email, updated);
      // Refund balance
      if(refundTotal > 0){
        const newBal = (currentUser?.balance || DB.getBalance(email)) + refundTotal;
        DB.updateBalance(email, newBal);
        return { txns: updated, changed, newBalance: newBal };
      }
    }
    return { txns: updated, changed, newBalance: null };
  };

  // Re-check every 60 seconds while app is open
  useEffect(()=>{
    if(!user || page!=="app") return;
    const interval = setInterval(()=>{
      const { txns: updated, changed, newBalance } = applyAutoFail(txns, user.email, user);
      if(changed){
        setTxns(updated);
        if(newBalance !== null){
          setUser(u=>({...u, balance: newBalance}));
          showToast("A withdrawal failed — your balance has been refunded.","info");
        } else {
          showToast("A withdrawal status has been updated.","info");
        }
      }
    }, 60000);
    return ()=>clearInterval(interval);
  },[user, txns, page]);

  const setTab = t => setTabRaw(t);

  // After signup → redirect to login with prefilled email
  const handleSignUp = newUser => {
    setPrefillEmail(newUser.email);
    setPage("login");
    setTimeout(()=>showToast("Account created! Please sign in.","success"),300);
  };

  // Login — load user data from DB
  const handleLogin = foundUser => {
    const savedTxns = DB.getTxns(foundUser.email);
    const latestUsers = DB.getUsers();
    const freshUser = latestUsers.find(u=>u.email===foundUser.email)||foundUser;
    const { txns: resolvedTxns, newBalance } = applyAutoFail(savedTxns, freshUser.email, freshUser);
    const finalUser = newBalance !== null ? {...freshUser, balance: newBalance} : freshUser;
    DB.saveSession(freshUser.email);
    setUser(finalUser);
    setTxns(resolvedTxns);
    setPage("app");
    setTabRaw("home");
    setTimeout(()=>showToast(`Welcome back, ${finalUser.name.split(" ")[0]}! 👋`,"success"),400);
  };

  const handleLogout = () => {
    DB.clearSession();
    setUser(null); setTxns([]); setPrefillEmail(""); setPage("login"); setTabRaw("home");
  };

  const MAIN_TABS = ["home","reward","buykey","profile"];
  const activeTab = MAIN_TABS.includes(tab) ? tab : "home";

  return (
    <>
      <GS/>
      <ToastCtx toast={toast}/>

      {page==="loading"  && (
        <Screen style={{background:`linear-gradient(160deg,${C.primary} 0%,${C.primaryDk} 100%)`,justifyContent:"center",alignItems:"center"}}>
          <div style={{textAlign:"center"}}>
            <div style={{width:64,height:64,background:"rgba(255,255,255,.18)",borderRadius:22,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="20" height="14" rx="3" fill="white" fillOpacity=".9"/><path d="M2 10h20" stroke={C.primaryDk} strokeWidth="2"/><rect x="5" y="13" width="5" height="2" rx="1" fill={C.primaryDk}/></svg>
            </div>
            <div style={{width:36,height:4,background:"rgba(255,255,255,.25)",borderRadius:4,overflow:"hidden",margin:"0 auto"}}>
              <div style={{height:"100%",background:"#fff",borderRadius:4,animation:"slideUp .8s ease infinite"}}/>
            </div>
          </div>
        </Screen>
      )}
      {page==="splash"   && <SplashScreen onNext={()=>setPage("signup")}/>}
      {page==="signup" && <SignUpScreen onSignUp={handleSignUp} goLogin={()=>setPage("login")}/>}
      {page==="login"  && <SignInScreen onLogin={handleLogin} goSignUp={()=>setPage("signup")} prefillEmail={prefillEmail}/>}

      {page==="app" && user && (
        <Screen style={{height:"100vh",overflow:"hidden"}}>
          <div style={{flex:1,overflow:"hidden",display:"flex",flexDirection:"column",minHeight:0}}>
            {activeTab==="home"    && <HomeTab    user={user} setUser={setUser} txns={txns} setTxns={setTxns} setTab={setTab}/>}
            {activeTab==="reward"  && <RewardsTab user={user} txns={txns}/>}
            {activeTab==="buykey"  && <BuyKeyTab  user={user} txns={txns} setTxns={setTxns} showToast={showToast}/>}
            {activeTab==="profile" && <ProfileTab user={user} onLogout={handleLogout}/>}
          </div>
          <BottomTabs active={activeTab} onChange={setTab}/>
          {tab==="withdraw_modal" && (
            <WithdrawModal user={user} setUser={setUser} txns={txns} setTxns={setTxns}
              onClose={()=>setTabRaw("home")} showToast={showToast} setTab={setTab}/>
          )}
        </Screen>
      )}
    </>
  );
}
