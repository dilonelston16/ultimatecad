import { createServerSupabaseClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function POST(req:Request){const supabase=await createServerSupabaseClient();const {data:{user}}=await supabase.auth.getUser();if(!user)return NextResponse.json({error:'Authentication required'},{status:401});const {code}=await req.json();const {data,error}=await supabase.rpc('redeem_permission_key',{p_code:code});if(error)return NextResponse.json({error:error.message},{status:400});return NextResponse.json({roleId:data});}
