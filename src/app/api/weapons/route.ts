import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function POST(request:Request){
 const supabase=await createServerSupabaseClient(); const {data:{user}}=await supabase.auth.getUser();
 if(!user)return NextResponse.json({error:"Authentication required."},{status:401});
 const b=await request.json(); const {data,error}=await supabase.rpc("register_weapon",{p_character_id:b.characterId,p_weapon_type:b.weaponType,p_make:b.make,p_model:b.model,p_caliber:b.caliber||null,p_notes:b.notes||null});
 if(error)return NextResponse.json({error:error.message},{status:400}); return NextResponse.json({weapon:data});
}
