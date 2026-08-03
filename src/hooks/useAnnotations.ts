import { useState, useEffect, useCallback } from 'react'
import { Annotation, Author, RichContent } from '../types/annotations'
import { v4 as uuidv4 } from 'uuid'

const STORAGE_KEY_PREFIX = 'embedpdf_annotations_'

// Simple uuid implementation if uuid package is not available
const generateId = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

export function useAnnotations(documentId: string) {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [currentAuthor, setCurrentAuthor] = useState<Author>(() => {
    const stored = localStorage.getItem('embedpdf_author')
    if (stored) {
      return JSON.parse(stored)
    }
    return { id: generateId(), name: 'User' }
  })
  const [isVisible, setIsVisible] = useState(true)
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [showComments, setShowComments] = useState(true)

  // Load annotations from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${documentId}`)
    if (stored) {
      try {
        setAnnotations(JSON.parse(stored))
      } catch (e) {
        console.error('Failed to parse stored annotations:', e)
      }
    }
  }, [documentId])

  // Save annotations to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY_PREFIX}${documentId}`, JSON.stringify(annotations))
  }, [annotations, documentId])

  // Save author to localStorage
  useEffect(() => {
    localStorage.setItem('embedpdf_author', JSON.stringify(currentAuthor))
  }, [currentAuthor])

  const addAnnotation = useCallback(
    (annotation: Omit<Annotation, 'id' | 'author' | 'createdAt' | 'comments'>) => {
      if (isReadOnly) return

      const newAnnotation: Annotation = {
        ...annotation,
        id: generateId(),
        author: currentAuthor,
        createdAt: Date.now(),
        comments: [],
      }
      setAnnotations((prev) => [...prev, newAnnotation])
      return newAnnotation
    },
    [currentAuthor, isReadOnly]
  )

  const updateAnnotation = useCallback(
    (id: string, updates: Partial<Annotation>) => {
      if (isReadOnly) return

      setAnnotations((prev) =>
        prev.map((annotation) =>
          annotation.id === id
            ? { ...annotation, ...updates, updatedAt: Date.now() }
            : annotation
        )
      )
    },
    [isReadOnly]
  )

  const deleteAnnotation = useCallback(
    (id: string) => {
      if (isReadOnly) return

      setAnnotations((prev) => prev.filter((annotation) => annotation.id !== id))
    },
    [isReadOnly]
  )

  const addComment = useCallback(
    (annotationId: string, content: RichContent) => {
      if (isReadOnly) return

      const comment = {
        id: generateId(),
        author: currentAuthor,
        content,
        createdAt: Date.now(),
      }

      setAnnotations((prev) =>
        prev.map((annotation) =>
          annotation.id === annotationId
            ? { ...annotation, comments: [...annotation.comments, comment] }
            : annotation
        )
      )
      return comment
    },
    [currentAuthor, isReadOnly]
  )

  const updateComment = useCallback(
    (annotationId: string, commentId: string, content: RichContent) => {
      if (isReadOnly) return

      setAnnotations((prev) =>
        prev.map((annotation) =>
          annotation.id === annotationId
            ? {
                ...annotation,
                comments: annotation.comments.map((comment) =>
                  comment.id === commentId
                    ? { ...comment, content, updatedAt: Date.now() }
                    : comment
                ),
              }
            : annotation
        )
      )
    },
    [isReadOnly]
  )

  const deleteComment = useCallback(
    (annotationId: string, commentId: string) => {
      if (isReadOnly) return

      setAnnotations((prev) =>
        prev.map((annotation) =>
          annotation.id === annotationId
            ? {
                ...annotation,
                comments: annotation.comments.filter((c) => c.id !== commentId),
              }
            : annotation
        )
      )
    },
    [isReadOnly]
  )

  const updateAuthorName = useCallback((name: string) => {
    setCurrentAuthor((prev) => ({ ...prev, name }))
  }, [])

  return {
    annotations,
    currentAuthor,
    isVisible,
    showComments,
    isReadOnly,
    setIsVisible,
    setShowComments,
    setIsReadOnly,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    addComment,
    updateComment,
    deleteComment,
    updateAuthorName,
  }
}

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key)
      return item ? (JSON.parse(item) as T) : initialValue
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error)
      return initialValue
    }
  })

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value
      setStoredValue(valueToStore)
      window.localStorage.setItem(key, JSON.stringify(valueToStore))
    } catch (error) {
      console.error(`Error setting localStorage key "${key}":`, error)
    }
  }

  return [storedValue, setValue] as const
}
