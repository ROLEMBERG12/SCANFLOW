'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  QrCode, 
  MapPin, 
  Plus, 
  Search, 
  Navigation, 
  Clock, 
  Package, 
  Smartphone,
  Activity,
  Eye,
  Download,
  RotateCw,
  Camera,
  X,
  CheckCircle
} from 'lucide-react'
import QRCode from 'qrcode'
import { Html5QrcodeScanner } from 'html5-qrcode'

interface TrackedObject {
  id: string
  name: string
  description: string
  qrCode: string
  location: {
    lat: number
    lng: number
    address: string
  }
  lastUpdate: Date
  status: 'active' | 'inactive' | 'moving'
}

interface LocationUpdate {
  lat: number
  lng: number
  address: string
  timestamp: Date
}

export default function CobliClone() {
  const [objects, setObjects] = useState<TrackedObject[]>([])
  const [selectedObject, setSelectedObject] = useState<TrackedObject | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isScanDialogOpen, setIsScanDialogOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [locationUpdates, setLocationUpdates] = useState<{ [key: string]: LocationUpdate[] }>({})
  const [isTracking, setIsTracking] = useState<{ [key: string]: boolean }>({})
  const [scanResult, setScanResult] = useState<string>('')
  const [scanError, setScanError] = useState<string>('')
  const [isScanning, setIsScanning] = useState(false)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)

  // Simular atualizações de GPS em tempo real
  useEffect(() => {
    const interval = setInterval(() => {
      setObjects(prevObjects => 
        prevObjects.map(obj => {
          if (isTracking[obj.id]) {
            // Simular movimento GPS (pequenas variações)
            const newLat = obj.location.lat + (Math.random() - 0.5) * 0.001
            const newLng = obj.location.lng + (Math.random() - 0.5) * 0.001
            const newAddress = `Lat: ${newLat.toFixed(6)}, Lng: ${newLng.toFixed(6)}`
            
            const newLocation = {
              lat: newLat,
              lng: newLng,
              address: newAddress,
              timestamp: new Date()
            }

            // Adicionar ao histórico de localizações
            setLocationUpdates(prev => ({
              ...prev,
              [obj.id]: [...(prev[obj.id] || []), newLocation].slice(-10) // Manter últimas 10 localizações
            }))

            return {
              ...obj,
              location: {
                lat: newLat,
                lng: newLng,
                address: newAddress
              },
              lastUpdate: new Date(),
              status: 'moving' as const
            }
          }
          return obj
        })
      )
    }, 3000) // Atualizar a cada 3 segundos

    return () => clearInterval(interval)
  }, [isTracking])

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear()
      }
    }
  }, [])

  const generateQRCode = async (data: string): Promise<string> => {
    try {
      return await QRCode.toDataURL(data, {
        width: 200,
        margin: 2,
        color: {
          dark: '#1e40af',
          light: '#ffffff'
        }
      })
    } catch (error) {
      console.error('Erro ao gerar QR Code:', error)
      return ''
    }
  }

  const createObject = async (formData: FormData) => {
    const name = formData.get('name') as string
    const description = formData.get('description') as string
    
    if (!name) return

    // Obter localização GPS real se disponível
    let initialLocation = {
      lat: -23.5505 + (Math.random() - 0.5) * 0.1,
      lng: -46.6333 + (Math.random() - 0.5) * 0.1,
      address: 'São Paulo, SP, Brasil'
    }

    try {
      if (navigator.geolocation) {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
          })
        })
        
        initialLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          address: `GPS: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`
        }
      }
    } catch (error) {
      console.log('GPS não disponível, usando localização simulada')
    }

    const objectId = Date.now().toString()
    const qrData = JSON.stringify({
      id: objectId,
      name,
      trackingUrl: `https://cobli-clone.app/track/${objectId}`,
      location: initialLocation,
      timestamp: new Date().toISOString()
    })

    const qrCodeDataUrl = await generateQRCode(qrData)

    const newObject: TrackedObject = {
      id: objectId,
      name,
      description,
      qrCode: qrCodeDataUrl,
      location: initialLocation,
      lastUpdate: new Date(),
      status: 'active'
    }

    setObjects(prev => [...prev, newObject])
    setIsCreateDialogOpen(false)
  }

  const startScanning = () => {
    setIsScanning(true)
    setScanResult('')
    setScanError('')
    
    // Limpar scanner anterior se existir
    if (scannerRef.current) {
      scannerRef.current.clear()
    }

    setTimeout(() => {
      try {
        scannerRef.current = new Html5QrcodeScanner(
          "qr-reader",
          { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          false
        )

        scannerRef.current.render(
          (decodedText) => {
            // Sucesso no scan
            setScanResult(decodedText)
            setIsScanning(false)
            
            try {
              const qrData = JSON.parse(decodedText)
              if (qrData.id && qrData.name) {
                // Encontrar objeto correspondente
                const foundObject = objects.find(obj => obj.id === qrData.id)
                if (foundObject) {
                  setSelectedObject(foundObject)
                  setScanResult(`✅ Objeto encontrado: ${foundObject.name}`)
                } else {
                  setScanResult(`⚠️ QR Code válido, mas objeto não encontrado no sistema`)
                }
              } else {
                setScanResult(`📄 QR Code lido: ${decodedText}`)
              }
            } catch {
              setScanResult(`📄 QR Code lido: ${decodedText}`)
            }
            
            if (scannerRef.current) {
              scannerRef.current.clear()
            }
          },
          (error) => {
            // Erro silencioso - normal durante o scan
          }
        )
      } catch (error) {
        setScanError('Erro ao inicializar câmera. Verifique as permissões.')
        setIsScanning(false)
      }
    }, 100)
  }

  const stopScanning = () => {
    setIsScanning(false)
    if (scannerRef.current) {
      scannerRef.current.clear()
    }
  }

  const toggleTracking = (objectId: string) => {
    setIsTracking(prev => ({
      ...prev,
      [objectId]: !prev[objectId]
    }))
  }

  const downloadQRCode = (object: TrackedObject) => {
    const link = document.createElement('a')
    link.download = `qr-${object.name.replace(/\s+/g, '-').toLowerCase()}.png`
    link.href = object.qrCode
    link.click()
  }

  const filteredObjects = objects.filter(obj =>
    obj.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    obj.description.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500'
      case 'moving': return 'bg-blue-500'
      case 'inactive': return 'bg-gray-500'
      default: return 'bg-gray-500'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo'
      case 'moving': return 'Em Movimento'
      case 'inactive': return 'Inativo'
      default: return 'Desconhecido'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <QrCode className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Cobli Clone</h1>
                <p className="text-sm text-gray-500">Rastreamento Inteligente</p>
              </div>
            </div>
            
            <div className="flex space-x-3">
              {/* Botão Gerar QR */}
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                    <QrCode className="w-4 h-4 mr-2" />
                    Gerar QR
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Gerar QR Code com GPS</DialogTitle>
                    <DialogDescription>
                      Crie um novo objeto e gere um QR Code único com localização GPS em tempo real
                    </DialogDescription>
                  </DialogHeader>
                  <form action={createObject} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Nome do Objeto</Label>
                      <Input
                        id="name"
                        name="name"
                        placeholder="Ex: Equipamento A1, Veículo 001..."
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        name="description"
                        placeholder="Descrição detalhada do objeto..."
                        rows={3}
                      />
                    </div>
                    <Button type="submit" className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
                      <QrCode className="w-4 h-4 mr-2" />
                      Gerar QR Code Único
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>

              {/* Botão Escanear QR */}
              <Dialog open={isScanDialogOpen} onOpenChange={setIsScanDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                    <Camera className="w-4 h-4 mr-2" />
                    Escanear QR
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Escanear QR Code</DialogTitle>
                    <DialogDescription>
                      Use a câmera para escanear um QR Code e localizar o objeto
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    {!isScanning && !scanResult && (
                      <div className="text-center py-8">
                        <Camera className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600 mb-4">Clique no botão abaixo para iniciar o escaneamento</p>
                        <Button onClick={startScanning} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                          <Camera className="w-4 h-4 mr-2" />
                          Iniciar Escaneamento
                        </Button>
                      </div>
                    )}

                    {isScanning && (
                      <div className="space-y-4">
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-gray-600">Posicione o QR Code na câmera</p>
                          <Button variant="outline" size="sm" onClick={stopScanning}>
                            <X className="w-4 h-4 mr-1" />
                            Parar
                          </Button>
                        </div>
                        <div id="qr-reader" className="w-full"></div>
                      </div>
                    )}

                    {scanResult && (
                      <Alert className="border-green-200 bg-green-50">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <AlertDescription className="text-green-800">
                          {scanResult}
                        </AlertDescription>
                      </Alert>
                    )}

                    {scanError && (
                      <Alert className="border-red-200 bg-red-50">
                        <X className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                          {scanError}
                        </AlertDescription>
                      </Alert>
                    )}

                    {(scanResult || scanError) && (
                      <div className="flex space-x-2">
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setScanResult('')
                            setScanError('')
                            startScanning()
                          }}
                          className="flex-1"
                        >
                          Escanear Novamente
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setScanResult('')
                            setScanError('')
                            setIsScanDialogOpen(false)
                          }}
                          className="flex-1"
                        >
                          Fechar
                        </Button>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Package className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total de Objetos</p>
                  <p className="text-2xl font-bold text-gray-900">{objects.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Activity className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Ativos</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {objects.filter(obj => obj.status === 'active' || obj.status === 'moving').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Navigation className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Em Movimento</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {objects.filter(obj => obj.status === 'moving').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <QrCode className="w-8 h-8 text-indigo-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">QR Codes</p>
                  <p className="text-2xl font-bold text-gray-900">{objects.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Buscar objetos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Objects Grid */}
        {filteredObjects.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {objects.length === 0 ? 'Nenhum objeto cadastrado' : 'Nenhum objeto encontrado'}
              </h3>
              <p className="text-gray-500 mb-6">
                {objects.length === 0 
                  ? 'Comece criando seu primeiro objeto para rastreamento'
                  : 'Tente ajustar os termos de busca'
                }
              </p>
              {objects.length === 0 && (
                <div className="flex justify-center space-x-4">
                  <Button 
                    onClick={() => setIsCreateDialogOpen(true)}
                    className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    Gerar Primeiro QR
                  </Button>
                  <Button 
                    onClick={() => setIsScanDialogOpen(true)}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Escanear QR
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredObjects.map((object) => (
              <Card key={object.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{object.name}</CardTitle>
                      <CardDescription className="mt-1">
                        {object.description || 'Sem descrição'}
                      </CardDescription>
                    </div>
                    <Badge className={`${getStatusColor(object.status)} text-white`}>
                      {getStatusText(object.status)}
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  {/* QR Code */}
                  <div className="flex justify-center">
                    <div className="bg-white p-2 rounded-lg border">
                      <img 
                        src={object.qrCode} 
                        alt={`QR Code para ${object.name}`}
                        className="w-32 h-32"
                      />
                    </div>
                  </div>
                  
                  {/* Location Info */}
                  <div className="space-y-2">
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mr-2" />
                      <span className="truncate">{object.location.address}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Clock className="w-4 h-4 mr-2" />
                      <span>Atualizado: {object.lastUpdate.toLocaleTimeString()}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      GPS: {object.location.lat.toFixed(6)}, {object.location.lng.toFixed(6)}
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => toggleTracking(object.id)}
                      className={isTracking[object.id] ? 'bg-blue-50 border-blue-200' : ''}
                    >
                      <RotateCw className={`w-4 h-4 mr-1 ${isTracking[object.id] ? 'animate-spin' : ''}`} />
                      {isTracking[object.id] ? 'Rastreando' : 'Iniciar GPS'}
                    </Button>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadQRCode(object)}
                    >
                      <Download className="w-4 h-4 mr-1" />
                      QR Code
                    </Button>
                  </div>
                  
                  {/* Real-time updates */}
                  {isTracking[object.id] && locationUpdates[object.id] && (
                    <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                      <div className="flex items-center text-sm font-medium text-blue-800 mb-2">
                        <Activity className="w-4 h-4 mr-1" />
                        Rastreamento Ativo
                      </div>
                      <div className="text-xs text-blue-600">
                        {locationUpdates[object.id]?.length || 0} atualizações de localização
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}