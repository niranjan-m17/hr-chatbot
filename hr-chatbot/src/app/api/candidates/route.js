import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

// GET all candidates (admin dashboard)
export async function GET(request) {
  try {
    const supabase = getServiceSupabase()
    const { searchParams } = new URL(request.url)
    
    const role = searchParams.get('role')
    const status = searchParams.get('status')
    const shortlisted = searchParams.get('shortlisted')
    const limit = parseInt(searchParams.get('limit') || '100')

    let query = supabase
      .from('candidates')
      .select('*')
      .order('total_score', { ascending: false })
      .limit(limit)

    if (role && role !== 'all') query = query.eq('applied_role', role)
    if (status && status !== 'all') query = query.eq('status', status)
    if (shortlisted === 'true') query = query.eq('is_shortlisted', true)

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ candidates: data, total: data.length })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// POST - create new candidate session
export async function POST(request) {
  try {
    const supabase = getServiceSupabase()
    const body = await request.json()

    const { data, error } = await supabase
      .from('candidates')
      .insert({ status: 'in_progress', ...body })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ candidate: data })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PATCH - update candidate (score override, shortlist, notes)
export async function PATCH(request) {
  try {
    const supabase = getServiceSupabase()
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) return NextResponse.json({ error: 'ID required' }, { status: 400 })

    const { data, error } = await supabase
      .from('candidates')
      .update(updates)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ candidate: data })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
