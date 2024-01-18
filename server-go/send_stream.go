package main

type SendStream struct {
	wt *Webtransport
}

func NewSendStream(wt *Webtransport) *SendStream {
	return &SendStream{
		wt: wt,
	}
}

func (ss *SendStream) Write(pkt []byte) (int, error) {
	return ss.wt.Write(pkt)
}
