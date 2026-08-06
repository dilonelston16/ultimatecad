import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function POST(request:Request){
 const supabase=await createServerSupabaseClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
 const b=await request.json(); const {data,error}=await supabase.rpc("purchase_store_product",{p_character_id:b.characterId,p_account_id:b.accountId,p_product_id:b.productId,p_quantity:Number(b.quantity||1)});
 if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({saleId:data});
}
