import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function POST(request:Request){
 const supabase=await createServerSupabaseClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
 const b=await request.json(); const {data,error}=await supabase.rpc("create_marketplace_listing",{p_character_id:b.characterId,p_listing_type:b.listingType,p_title:b.title,p_description:b.description||null,p_price:Number(b.price||0),p_reference_type:null,p_reference_id:null});
 if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({listing:data});
}
