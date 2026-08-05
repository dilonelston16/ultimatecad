import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  BriefcaseBusiness,
  Building2,
  Car,
  Check,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Gavel,
  Headphones,
  IdCard,
  KeyRound,
  Landmark,
  LockKeyhole,
  MessageSquareMore,
  RadioTower,
  Scale,
  ShieldCheck,
  Siren,
  Smartphone,
  Store,
  Workflow,
  Wrench,
} from "lucide-react";

const modules = [
  { icon: Siren, title: "Law Enforcement", text: "Reports, citations, arrests, warrants, BOLOs, evidence, unit status, supervisor tools and panic alerts." },
  { icon: RadioTower, title: "Dispatch", text: "Call handling, unit assignment, console filtering, radio logs, self-dispatch and priority incident management." },
  { icon: Headphones, title: "Fire & EMS", text: "Incident reports, patient records, stations, apparatus, medical calls and department clock-ins." },
  { icon: Scale, title: "Judicial", text: "Court cases, hearings, judges, attorneys, warrants, appeals, sentencing and digital court records." },
  { icon: Wrench, title: "Towing & Corrections", text: "Tow calls, impounds, storage fees, jail intake, inmates, sentences, releases and transfers." },
  { icon: Landmark, title: "Banking & Economy", text: "Personal and business accounts, loans, fines, taxes, payroll, market controls and government budgets." },
  { icon: BriefcaseBusiness, title: "Businesses", text: "Ownership, employees, payroll, inventory, sales, licensing, expenses and financial reporting." },
  { icon: Store, title: "Stores & Inventory", text: "Purchases, stock, suppliers, register activity, deliveries and player-owned inventory management." },
  { icon: IdCard, title: "Licenses & DMV", text: "Driving and weapon tests, auto-generated license numbers, registrations, VINs, plates and insurance." },
  { icon: Car, title: "Civilian Records", text: "Characters, vehicles, properties, employment, weapons, insurance, businesses and record timelines." },
  { icon: Gavel, title: "Penal Code Engine", text: "Search community penal codes and attach charges to reports, citations, warrants, arrests and court cases." },
  { icon: MessageSquareMore, title: "Discord Integration", text: "Discord login, role sync, department access, server linking, notifications and audit-ready activity." },
];

const sellingPoints = [
  { icon: Building2, title: "Built for multiple communities", text: "Every customer receives a separate, tenant-isolated workspace with its own branding, structure, permissions and data." },
  { icon: Workflow, title: "Real agency structure", text: "Model agencies, departments, divisions and subdivisions exactly the way your community operates." },
  { icon: KeyRound, title: "Permission-key access", text: "Every member receives civilian access while department modules unlock through permission keys, roles and approvals." },
  { icon: BellRing, title: "Cross-CAD panic system", text: "On-duty units receive an immediate audio and visual emergency alert when an officer activates panic." },
  { icon: Clock3, title: "Console-aware clock-ins", text: "Track PS4, PS5, Xbox One and Xbox Series X|S units, departments, callsigns, shifts and status." },
  { icon: LockKeyhole, title: "Commercial-grade controls", text: "Tenant isolation, audit logs, role permissions, founder controls and secure Supabase-backed authentication." },
];

const plans = [
  {
    name: "Community",
    price: "$0",
    suffix: "/month",
    description: "For new communities testing the platform.",
    featured: false,
    features: ["Up to 50 members", "1 community", "Basic LEO and Dispatch", "Civilian records", "Vehicles and banking", "Discord login", "Basic reports", "Community branding"],
  },
  {
    name: "Professional",
    price: "$14.99",
    suffix: "/month",
    description: "The complete core platform for growing communities.",
    featured: true,
    badge: "Most popular",
    features: ["Up to 250 members", "All core RP modules", "Unlimited agencies", "Organization Builder", "Permission Builder", "Clock-in system", "Discord role sync", "Automatic ID engine", "Custom branding", "Advanced reports"],
  },
  {
    name: "Enterprise",
    price: "$29.99",
    suffix: "/month",
    description: "For large communities that need deeper operations.",
    featured: false,
    features: ["Up to 1,000 members", "Everything in Professional", "Corrections and jail", "Advanced economy", "Property and loan systems", "Public portal", "Advanced analytics", "Workflow automation", "Priority support"],
  },
  {
    name: "Ultimate",
    price: "$49.99",
    suffix: "/month",
    description: "Maximum scale, customization and premium tools.",
    featured: false,
    features: ["Unlimited members", "Multi-community management", "White-label branding", "Custom domain support", "Full AI suite", "API access", "Marketplace access", "Premium support", "Early feature access"],
  },
];

const faqs = [
  ["Is UltimateCAD only for FiveM?", "No. UltimateCAD is designed specifically for Xbox and PlayStation GTA roleplay communities, including PS4, PS5, Xbox One and Xbox Series X|S."],
  ["Can every community customize its structure?", "Yes. Owners can build agencies, departments, divisions and subdivisions, then assign callsigns, permissions, Discord roles and training requirements."],
  ["Do civilians need a department key?", "No. Civilian access is available to all community members. Permission keys are used for restricted agencies and departments."],
  ["Are license and serial numbers automatic?", "Yes. UltimateCAD generates unique community-prefixed IDs for licenses, insurance policies, vehicles, reports, evidence, weapons and many other records."],
  ["Will the plans lock essential departments?", "No. Paid plans are designed around scale and advanced capabilities rather than forcing communities to purchase core departments separately."],
  ["Can Discord control access?", "Yes. Discord login is built in, and role mapping and synchronization can grant or remove department access as your community changes."],
];

export default function Home() {
  return (
    <main className="marketing-page">
      <nav className="marketing-nav">
        <Link href="/" className="brand marketing-brand">
          <span className="brand-mark">U</span>
          <span><strong>UltimateCAD</strong><small>Console RP operating system</small></span>
        </Link>
        <div className="marketing-links">
          <a href="#platform">Platform</a>
          <a href="#modules">Modules</a>
          <a href="#pricing">Pricing</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="nav-actions">
          <Link className="button ghost" href="/login">Sign in</Link>
          <Link className="button" href="/onboarding">Create community</Link>
        </div>
      </nav>

      <section className="marketing-hero">
        <div className="hero-glow hero-glow-one" />
        <div className="hero-glow hero-glow-two" />
        <div className="hero-copy marketing-hero-copy">
          <div className="hero-badge"><ShieldCheck size={15} /> Built for Xbox & PlayStation GTA roleplay</div>
          <h1>Run your entire RP community from one realistic platform.</h1>
          <p>UltimateCAD combines CAD/MDT, civilian records, Discord access, departments, courts, jail, towing, banking, businesses, economy, licensing and administration in one commercial multi-community system.</p>
          <div className="hero-actions">
            <Link className="button large" href="/onboarding">Start building <ArrowRight size={17} /></Link>
            <Link className="button ghost large" href="/agencies/law-enforcement">Preview LEO dashboard</Link>
          </div>
          <div className="trust-row marketing-trust">
            <span><ShieldCheck size={17}/> Tenant-isolated</span>
            <span><BadgeCheck size={17}/> Permission-driven</span>
            <span><RadioTower size={17}/> Discord-integrated</span>
            <span><Smartphone size={17}/> Mobile-ready</span>
          </div>
        </div>

        <div className="product-preview" aria-label="UltimateCAD dashboard preview">
          <div className="preview-topbar">
            <div className="preview-logo">U</div>
            <div className="preview-search">Search names, plates, reports, cases...</div>
            <div className="preview-panic">PANIC</div>
          </div>
          <div className="preview-body">
            <div className="preview-sidebar">
              {['Dashboard','Civilian','Banking','Businesses','Economy','My Department'].map((item, index) => <div className={index === 0 ? 'active' : ''} key={item}>{item}</div>)}
            </div>
            <div className="preview-main">
              <div className="preview-kpis">
                {[["12","Active calls"],["28","Units on duty"],["24","Reports today"],["6","Active BOLOs"]].map(([number,label]) => <div key={label}><strong>{number}</strong><span>{label}</span></div>)}
              </div>
              <div className="preview-panels">
                <div className="preview-card preview-calls">
                  <b>Active calls</b>
                  <div><span className="priority-dot red"/>10-13 Shots fired <small>2 min</small></div>
                  <div><span className="priority-dot amber"/>10-46 Traffic accident <small>5 min</small></div>
                  <div><span className="priority-dot blue"/>Suspicious activity <small>9 min</small></div>
                </div>
                <div className="preview-card">
                  <b>Unit status</b>
                  <div className="preview-unit"><span>2A-15</span><em>PS5</em><strong>10-8</strong></div>
                  <div className="preview-unit"><span>3B-21</span><em>Xbox X|S</em><strong>10-7</strong></div>
                  <div className="preview-unit"><span>1C-12</span><em>PS4</em><strong>10-6</strong></div>
                </div>
              </div>
              <div className="preview-actions">
                {['New report','New citation','Self dispatch','Penal codes'].map(item => <span key={item}>{item}</span>)}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="stats-strip">
        <div><strong>4</strong><span>Console platforms</span></div>
        <div><strong>12+</strong><span>Core platform modules</span></div>
        <div><strong>300+</strong><span>Permission targets planned</span></div>
        <div><strong>1</strong><span>Connected RP operating system</span></div>
      </section>

      <section id="platform" className="marketing-section split-section">
        <div>
          <div className="section-kicker">One connected platform</div>
          <h2>More than a CAD. A complete operating system for your community.</h2>
          <p className="section-lead">Every action can connect across characters, departments, finance, courts, Discord and community administration. Reports can attach characters, vehicles, weapons, businesses, properties, evidence and penal codes without forcing staff to jump between disconnected systems.</p>
          <div className="feature-checks">
            {["Shared civilian and economy modules for every member","Department-only visibility for authorized users","Global search across every record you have permission to access","Automatic audit history for important actions","Custom branding, prefixes, forms and workflows per community"].map(item => <div key={item}><Check size={16}/><span>{item}</span></div>)}
          </div>
        </div>
        <div className="structure-card">
          <div className="structure-heading"><Building2 size={20}/><span>Community organization</span></div>
          <div className="structure-node root-node">Ultimate World Roleplay</div>
          <div className="structure-connector" />
          <div className="structure-node level-one">Law Enforcement Agency</div>
          <div className="structure-connector short" />
          <div className="structure-branches">
            <div>LSPD</div><div>BCSO</div><div>SAHP</div>
          </div>
          <div className="structure-detail">
            <span>Patrol Division</span><ChevronRight size={14}/><span>Traffic Subdivision</span>
          </div>
          <p>Owners build their real hierarchy, while members only see the departments and divisions they are authorized to access.</p>
        </div>
      </section>

      <section id="modules" className="marketing-section modules-section">
        <div className="section-heading centered">
          <div className="section-kicker">Everything works together</div>
          <h2>Every major roleplay system in one place.</h2>
          <p>Each sidebar tab opens its own complete workspace rather than squeezing the entire platform into one crowded screen.</p>
        </div>
        <div className="module-grid">
          {modules.map(({ icon: Icon, title, text }) => (
            <article className="module-card" key={title}>
              <div className="module-icon"><Icon size={21}/></div>
              <h3>{title}</h3>
              <p>{text}</p>
              <span>Dedicated dashboard <ArrowRight size={13}/></span>
            </article>
          ))}
        </div>
      </section>

      <section className="marketing-section selling-section">
        <div className="section-heading centered">
          <div className="section-kicker">Designed to sell and scale</div>
          <h2>Built as a commercial multi-community platform.</h2>
          <p>UltimateCAD is designed so one product can serve small communities, established servers and large multi-server networks without mixing their data.</p>
        </div>
        <div className="selling-grid">
          {sellingPoints.map(({ icon: Icon, title, text }) => <article key={title}><Icon size={23}/><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <section className="marketing-section id-engine-section">
        <div className="id-engine-copy">
          <div className="section-kicker">Automatic identification engine</div>
          <h2>Permanent IDs generated the moment records are approved.</h2>
          <p>Every important record receives a unique, community-specific identifier. Readable numbers support roleplay, while hidden UUIDs protect database integrity.</p>
          <div className="id-list">
            {['Driver licenses','Weapon licenses','Insurance policies','Weapon serial numbers','VINs and plates','Reports and citations','Court cases and evidence','Businesses and bank accounts'].map(item => <span key={item}><Check size={14}/>{item}</span>)}
          </div>
        </div>
        <div className="id-samples">
          <div><small>Driver license</small><strong>UWRP-DL-26-104827</strong></div>
          <div><small>Insurance policy</small><strong>UWRP-INS-26-483920</strong></div>
          <div><small>Weapon serial</small><strong>UWRP-HG-26-583104</strong></div>
          <div><small>Court case</small><strong>UWRP-CASE-26-000183</strong></div>
        </div>
      </section>

      <section id="pricing" className="marketing-section pricing-section">
        <div className="section-heading centered">
          <div className="section-kicker">Simple pricing</div>
          <h2>A complete platform at a price console communities can afford.</h2>
          <p>Core departments stay available across paid plans. Communities upgrade mainly for scale, automation, analytics, branding and premium capabilities.</p>
        </div>
        <div className="pricing-grid">
          {plans.map(plan => (
            <article className={`price-card ${plan.featured ? 'featured' : ''}`} key={plan.name}>
              {plan.badge && <div className="price-badge">{plan.badge}</div>}
              <h3>{plan.name}</h3>
              <p>{plan.description}</p>
              <div className="price"><strong>{plan.price}</strong><span>{plan.suffix}</span></div>
              <Link className={`button ${plan.featured ? '' : 'ghost'}`} href="/onboarding">{plan.price === '$0' ? 'Start free' : `Choose ${plan.name}`}</Link>
              <div className="price-features">
                {plan.features.map(feature => <div key={feature}><Check size={15}/><span>{feature}</span></div>)}
              </div>
            </article>
          ))}
        </div>
        <div className="pricing-note"><CircleDollarSign size={18}/><span>Annual billing, launch promotions and founder pricing can be added before public release.</span></div>
      </section>

      <section className="marketing-section workflow-section">
        <div className="section-heading centered">
          <div className="section-kicker">Fast community setup</div>
          <h2>Go from an empty account to an operational community.</h2>
        </div>
        <div className="workflow-steps">
          {[
            ["01","Sign in with Discord","Secure Discord OAuth creates the member profile."],
            ["02","Create or join","Founders create a workspace; members join by code or permission key."],
            ["03","Build your structure","Add agencies, departments, divisions and subdivisions."],
            ["04","Map access","Connect roles, permissions, callsigns, consoles and required training."],
            ["05","Start roleplay","Open the dashboards, create characters and begin operations."],
          ].map(([number,title,text]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{text}</p></article>)}
        </div>
      </section>

      <section id="faq" className="marketing-section faq-section">
        <div className="section-heading centered">
          <div className="section-kicker">Frequently asked questions</div>
          <h2>Everything communities need to know before joining.</h2>
        </div>
        <div className="faq-grid">
          {faqs.map(([question,answer]) => <article key={question}><h3>{question}</h3><p>{answer}</p></article>)}
        </div>
      </section>

      <section className="final-cta">
        <div>
          <div className="section-kicker">Build your community properly</div>
          <h2>Replace scattered spreadsheets, bots and disconnected CAD tools.</h2>
          <p>Create one secure UltimateCAD workspace for every part of your roleplay community.</p>
        </div>
        <div className="hero-actions">
          <Link className="button large" href="/onboarding">Create your community <ArrowRight size={17}/></Link>
          <Link className="button ghost large" href="/login">Sign in with Discord</Link>
        </div>
      </section>

      <footer className="marketing-footer">
        <div className="brand"><span className="brand-mark">U</span><span>UltimateCAD</span></div>
        <p>Commercial multi-community CAD/MDT for Xbox and PlayStation GTA roleplay.</p>
        <div><a href="#platform">Platform</a><a href="#pricing">Pricing</a><Link href="/login">Sign in</Link></div>
      </footer>
    </main>
  );
}
