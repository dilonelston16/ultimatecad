import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function POST(request:Request){
 const supabase=await createServerSupabaseClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
 const b=await request.json(); const {data,error}=await supabase.rpc("register_property",{p_character_id:b.characterId,p_property_type:b.propertyType,p_address:b.address,p_unit_number:b.unitNumber||null,p_purchase_price:b.purchasePrice?Number(b.purchasePrice):null,p_garage_spaces:Number(b.garageSpaces||0),p_notes:b.notes||null});
 if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({property:data});
}
