import { NextResponse } from 'next/server'
import { getServiceSupabase } from '@/lib/supabase'

// POST /api/shortlist - Auto-shortlist top 10 per role
export async function POST(request) {
  try {
    const supabase = getServiceSupabase()
    const { role } = await request.json()

    // Reset existing shortlist for this role
    await supabase
      .from('candidates')
      .update({ is_shortlisted: false })
      .eq('applied_role', role)
      .eq('status', 'completed')

    // Get top 10 completed candidates for this role
    const { data: topCandidates, error } = await supabase
      .from('candidates')
      .select('id, total_score, full_name')
      .eq('applied_role', role)
      .eq('status', 'completed')
      .order('total_score', { ascending: false })
      .limit(10)

    if (error) throw error

    if (!topCandidates.length) {
      return NextResponse.json({ message: 'No completed candidates found', shortlisted: [] })
    }

    const ids = topCandidates.map(c => c.id)

    // Mark as shortlisted
    await supabase
      .from('candidates')
      .update({ is_shortlisted: true, status: 'shortlisted' })
      .in('id', ids)

    return NextResponse.json({ 
      success: true, 
      shortlisted: topCandidates,
      count: ids.length,
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
