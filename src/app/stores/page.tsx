import { AppShell } from "@/components/app-shell";
export default function StoresPage(){
  return <AppShell title="Stores" subtitle="Community marketplace">
    <div style={{padding:24}}>
      <section style={{padding:24,border:"1px solid #203b5d",borderRadius:16,background:"#08172b"}}>
        <h2>Store management foundation is installed</h2>
        <p style={{color:"#839bb7"}}>Products, stock, purchases, taxes, sales and character inventory are now supported by the database. The full store catalogue and management interface will be expanded in the next operational UI pass.</p>
      </section>
    </div>
  </AppShell>;
}
