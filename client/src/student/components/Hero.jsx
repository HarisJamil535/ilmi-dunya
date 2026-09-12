import React, { useState, useRef, useEffect, useContext } from 'react'
import { AppContext } from '../../context/AppContext'
import heroImg from '../../assets/hero_img.jpg'
import { ChevronDown, Check, GraduationCap, Building2, ArrowRight, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import axiosInstance from '../../api/axios' // Adjust path to your axios instance

const Dropdown = ({ label, icon: Icon, options, placeholder, onSelect, isLoading }) => {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState(null)
  const ref = useRef(null)

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className='flex flex-col gap-1.5 flex-1 relative' ref={ref}>
      {/* Label */}
      <label
        className='text-sm font-semibold text-left flex items-center gap-1.5'
        style={{ color: 'var(--color-text-primary)' }}
      >
        {Icon && <Icon size={14} style={{ color: 'var(--color-primary)' }} />}
        {label}
      </label>

      {/* Trigger */}
      <button
        type='button'
        disabled={isLoading}
        onClick={() => setOpen(!open)}
        className='input flex items-center justify-between cursor-pointer group disabled:opacity-60 disabled:cursor-not-allowed'
        style={{
          borderColor: open ? 'var(--color-primary)' : 'var(--color-border)',
          boxShadow: open ? '0 0 0 3px rgba(79,70,229,0.12)' : 'none',
          transition: 'all 0.2s ease',
        }}
      >
        <div className='flex items-center gap-2'>
          {isLoading ? (
            <div className='flex items-center gap-2 text-xs text-slate-400'>
              <Loader2 size={14} className='animate-spin text-[#4F46E5]' />
              <span>Loading options...</span>
            </div>
          ) : selected ? (
            <div className='text-left'>
              <p className='text-sm font-medium' style={{ color: 'var(--color-text-primary)' }}>
                {selected.label}
              </p>
            </div>
          ) : (
            <p className='text-sm' style={{ color: 'var(--color-text-muted)' }}>
              {placeholder}
            </p>
          )}
        </div>
        <ChevronDown
          size={16}
          style={{
            color: 'var(--color-text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.3s ease',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Dropdown Options */}
      <div
        className='absolute left-0 right-0 z-50 bg-white rounded-xl overflow-hidden'
        style={{
          top: '100%',
          marginTop: '6px',
          border: '1px solid var(--color-border)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
          maxHeight: open ? '280px' : '0px',
          opacity: open ? 1 : 0,
          transition: 'max-height 0.3s ease, opacity 0.25s ease',
          overflowY: 'auto',
          pointerEvents: open ? 'all' : 'none',
        }}
      >
        {options.length === 0 ? (
          <div className='p-4 text-xs text-slate-400 text-center'>No options found</div>
        ) : (
          options.map((option, i) => (
            <div
              key={option.value}
              onClick={() => {
                setSelected(option)
                if (onSelect) {
                  onSelect(option)
                }
                setOpen(false)
              }}
              className='flex items-center hover:bg-[rgba(79,70,229,0.06)] justify-between px-4 py-3 cursor-pointer transition-all duration-150'
              style={{
                borderBottom: i < options.length - 1 ? '1px solid var(--color-border-light)' : 'none',
              }}
            >
              <div>
                <p className='text-sm text-left font-medium' style={{ color: 'var(--color-text-primary)' }}>
                  {option.label}
                </p>
                {option.desc && (
                  <p className='text-xs text-left mt-0.5' style={{ color: 'var(--color-text-muted)' }}>
                    {option.desc}
                  </p>
                )}
              </div>
              {selected?.value === option.value && (
                <div
                  className='w-5 h-5 rounded-full flex items-center justify-center'
                  style={{ backgroundColor: 'var(--color-primary)' }}
                >
                  <Check size={11} color='white' />
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

const Hero = () => {
  const navigate = useNavigate()
  const { setSelectedClass, setSelectedBoard, selectedClass, selectedBoard } = useContext(AppContext)

  // Dynamic states for database values
  const [classesList, setClassesList] = useState([])
  const [boardsList, setBoardsList] = useState([])
  const [isLoading, setIsLoading] = useState(true)

  // Fetch Boards and Classes from backend API
  useEffect(() => {
    const fetchHeroData = async () => {
      setIsLoading(true)
      try {
        const [classesRes, boardsRes] = await Promise.all([
          axiosInstance.get('/classes'),
          axiosInstance.get('/boards'),
        ])

        const rawClasses = classesRes.data.classes || classesRes.data || []
        const rawBoards = boardsRes.data.boards || boardsRes.data || []

        // Format Classes for Dropdown
        const formattedClasses = rawClasses.map((c) => {
          const num = c.classNumber ? String(c.classNumber) : (c.name || '').replace(/class\s*/i, '').trim()
          return {
            value: num,
            label: (c.name || '').toLowerCase().includes('class') ? c.name : `Class ${c.name || num}`,
            desc: c.description || (parseInt(num) <= 10 ? 'Secondary School' : 'Higher Secondary'),
          }
        })

        // Format Boards for Dropdown
        const formattedBoards = rawBoards.map((b) => {
          const name = b.name || String(b)
          const val = name.toLowerCase().replace(/\s*board/i, '').trim()
          return {
            value: val,
            label: name.toLowerCase().includes('board') ? name : `${name} Board`,
            desc: b.code ? `BISE - ${b.code}` : b.description || 'Educational Board',
          }
        })

        setClassesList(formattedClasses)
        setBoardsList(formattedBoards)
      } catch (error) {
        console.error('Failed to load hero dropdown options:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchHeroData()
  }, [])

  const handleStartLearning = () => {
    if (!selectedBoard || !selectedClass) {
      alert('Please select both your Grade and Board to continue.')
      return
    }
    navigate(`/subjects?board=${selectedBoard}&class=${selectedClass}`)
  }

  return (
    <div
      className='min-h-dvh flex flex-col justify-center items-center text-center px-4 relative'
      style={{
        backgroundImage: `linear-gradient(rgba(250,248,245,0.88), rgba(250,248,245,0.94)), url(${heroImg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      {/* Badge */}
      <div
        className='flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium mb-6'
        style={{
          backgroundColor: 'rgba(79,70,229,0.08)',
          color: 'var(--color-primary)',
          border: '1px solid rgba(79,70,229,0.15)',
        }}
      >
        <span>🇵🇰</span>
        <span>Pakistan's #1 Learning Platform</span>
      </div>

      {/* Heading */}
      <h1
        className='text-4xl md:text-6xl font-bold max-w-3xl leading-tight'
        style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-heading)' }}
      >
        Your Complete{' '}
        <span className='relative inline-block' style={{ color: 'var(--color-primary)' }}>
          Learning Hub
          <svg className='absolute -bottom-2 left-0 w-full' height='6' viewBox='0 0 300 6'>
            <path
              d='M0,3 Q75,0 150,3 Q225,6 300,3'
              stroke='#4F46E5'
              strokeWidth='2.5'
              fill='none'
              strokeLinecap='round'
              opacity='0.4'
            />
          </svg>
        </span>
      </h1>

      {/* Subheading */}
      <p className='text-lg mt-6 max-w-xl leading-relaxed' style={{ color: 'var(--color-text-muted)' }}>
        Access notes, past papers, video lectures & practice tests for{' '}
        <strong style={{ color: 'var(--color-text-secondary)' }}>all Pakistani educational boards</strong>
      </p>

      {/* Selection Card */}
      <div
        className='mt-10 w-full max-w-2xl rounded-2xl p-6'
        style={{
          backgroundColor: 'white',
          boxShadow: '0 8px 40px rgba(0,0,0,0.10)',
          border: '1px solid var(--color-border)',
        }}
      >
        <p className='text-sm font-semibold mb-4 text-left' style={{ color: 'var(--color-text-muted)' }}>
          GET STARTED — SELECT YOUR DETAILS
        </p>

        <div className='flex flex-col sm:flex-row gap-4'>
          <Dropdown
            label='Your Grade'
            icon={GraduationCap}
            options={classesList}
            isLoading={isLoading}
            onSelect={(option) => setSelectedClass(option.value)}
            placeholder='Select your Grade'
          />
          <Dropdown
            label='Your Board'
            icon={Building2}
            options={boardsList}
            isLoading={isLoading}
            onSelect={(option) => setSelectedBoard(option.value)}
            placeholder='Select your Board'
          />
        </div>

        <button
          className='btn-primary w-full mt-4 flex items-center justify-center gap-2 cursor-pointer'
          onClick={handleStartLearning}
          style={{ padding: '0.75rem' }}
        >
          <span>Start Learning Now</span>
          <ArrowRight size={16} />
        </button>
      </div>

      {/* Stats */}
      <div className='flex gap-10 mt-12'>
        {[
          { number: '50,000+', label: 'Students' },
          { number: '500+', label: 'Video Lectures' },
          { number: '10,000+', label: 'Past Papers' },
        ].map((stat, i) => (
          <div key={stat.label} className='text-center flex items-center gap-10'>
            <div>
              <p
                className='text-2xl font-bold'
                style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-heading)' }}
              >
                {stat.number}
              </p>
              <p className='text-xs mt-0.5' style={{ color: 'var(--color-text-muted)' }}>
                {stat.label}
              </p>
            </div>
            {i < 2 && <div className='w-px h-8' style={{ backgroundColor: 'var(--color-border)' }} />}
          </div>
        ))}
      </div>
    </div>
  )
}

export default Hero