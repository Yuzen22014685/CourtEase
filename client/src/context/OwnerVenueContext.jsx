import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getAdminVenues } from '../api/admin'

const OwnerVenueContext = createContext(null)

export function OwnerVenueProvider({ children }) {
  const [venues, setVenues] = useState([])
  const [selectedVenueId, setSelectedVenueId] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchVenues = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAdminVenues()
      const list = res.data?.data ?? []
      setVenues(list)
      if (list.length > 0) {
        setSelectedVenueId((prev) => {
          if (prev && list.some((v) => v._id === prev)) {
            return prev
          }
          return list[0]._id
        })
      } else {
        setSelectedVenueId('')
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load venues')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchVenues()
  }, [fetchVenues])

  const selectedVenue = venues.find((v) => v._id === selectedVenueId) || venues[0] || null

  const value = {
    venues,
    selectedVenue,
    selectedVenueId,
    setSelectedVenueId,
    loading,
    error,
    refetchVenues: fetchVenues,
  }

  return (
    <OwnerVenueContext.Provider value={value}>
      {children}
    </OwnerVenueContext.Provider>
  )
}

export function useOwnerVenue() {
  return useContext(OwnerVenueContext) || {
    venues: [],
    selectedVenue: null,
    selectedVenueId: '',
    setSelectedVenueId: () => {},
    loading: false,
    error: null,
    refetchVenues: () => {},
  }
}
