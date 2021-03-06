import { Module, ActionTree, MutationTree, GetterTree } from 'vuex'
import { RootState } from '@/store'
import { Auth } from 'aws-amplify'
import { onError } from '../../libs/errorLib'
import navigate from '../../libs/navigate'

export interface AuthState {
  user: string | null;
  token: string | null;
  status: string;
}

const state: AuthState = {
  user: null,
  token: localStorage.getItem('user-token') || null,
  status: ''
}

const mutations: MutationTree<AuthState> = {
  setUser (state, user) {
    state.user = user
  },
  authRequest (state) {
    state.status = 'loading'
  },
  authSuccess (state, token) {
    state.status = 'success'
    state.token = token
  },
  authError (state) {
    state.status = 'error'
    state.token = null
  },
  clearSession (state) {
    state.status = ''
    state.user = null
    state.token = null
  }
}

const actions: ActionTree<AuthState, RootState> = {
  async login ({ commit, dispatch }, { email, password }) {
    commit('authRequest')
    try {
      const user = await Auth.signIn(email, password)
      const token = user.signInUserSession.accessToken.jwtToken
      commit('setUser', user.attributes)
      commit('authSuccess', token)
      // Now the user is authenticated we can ask the
      // referrals vuex store to fetch the referral count
      dispatch('Referrals/fetchCount', {}, { root: true })
      commit('Accounts/setEmailCodeConfirmed', false, { root: true })
      localStorage.setItem('user-token', token)
      navigate('/')
    } catch (e) {
      localStorage.removeItem('user-token')
      onError(e)
      commit('authError')
    }
  },
  async signOut ({ commit }) {
    try {
      commit('clearSession')
      localStorage.removeItem('user-token')
      await Auth.signOut()
      navigate('/')
    } catch (e) {
      onError(e)
    }
  },
  // currentSession action handles when user refreshes the app
  async currentSession ({ commit, dispatch }) {
    commit('authRequest')
    try {
      const session = await Auth.currentSession()
      const user = await Auth.currentUserInfo()
      commit('authSuccess', session.getIdToken().getJwtToken())
      commit('setUser', user.attributes)
    } catch (e) {
      onError(e)
      // AWS Session error so signOut!
      dispatch('signOut')
    }
  }
}

const getters: GetterTree<AuthState, RootState> = {
  getUser: state => state.user,
  isAuthenticated: state => !!state.token,
  authStatus: state => state.status
}

const module: Module<AuthState, RootState> = {
  state,
  mutations,
  actions,
  getters,
  namespaced: true
}

export default module
