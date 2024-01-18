package main

type ReceiveStream struct {
	wt      *Webtransport
	sink    chan []byte
	onclose func()
}

func NewReceiveStream(wt *Webtransport) *ReceiveStream {
	sink := make(chan []byte)
	wt.setSink(sink)
	return &ReceiveStream{
		wt:   wt,
		sink: sink,
	}
}

func (rs *ReceiveStream) onClose(cb func()) {
	rs.onclose = cb
}

func (rs *ReceiveStream) startRecieveLoop() {
	rs.wt.handleRecv()
	rs.onclose()
}
